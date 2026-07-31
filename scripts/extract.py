"""Extrae tareas de todos los archivos .mpp encontrados en un directorio de
datos (sueltos o dentro de .zip) usando MPXJ (via JPype). Genera un JSON de
tareas por proyecto mas un manifest.json con la lista de proyectos disponibles.

Uso:
    python extract.py <directorio_datos> <directorio_salida>
"""
import sys
import os
import re
import json
import shutil
import zipfile
import tempfile

import jpype
import mpxj  # debe importarse antes de startJVM: registra el jar de MPXJ en el classpath
import jpype.imports


def fmt_date(java_date):
    if java_date is None:
        return None
    return str(java_date).split("T")[0] if "T" in str(java_date) else str(java_date)[:10]


def fmt_duration(d):
    if d is None:
        return ""
    return f"{d.getDuration():.0f}{str(d.getUnits())[:1].lower()}"


def fmt_enum(value):
    if value is None:
        return ""
    return str(value).replace("_", " ").title()


def slugify(name):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    return s or "proyecto"


def extract_tasks(reader, mpp_path):
    project = reader.read(mpp_path)

    tasks = []
    for task in project.getTasks():
        if task.getUniqueID() == 0 and task.getName() is None:
            continue

        name = str(task.getName()) if task.getName() is not None else None
        outline_level = task.getOutlineLevel()
        wbs = task.getWBS()
        start = task.getStart()
        finish = task.getFinish()
        duration = task.getDuration()
        pct = task.getPercentageComplete()
        predecessors = task.getPredecessors()
        successors = task.getSuccessors()
        resources = task.getResourceAssignments()
        cost = task.getCost()
        notes = task.getNotes()
        priority = task.getPriority()

        pred_str = ""
        if predecessors:
            pred_str = ", ".join(
                str(p.getPredecessorTask().getID()) for p in predecessors if p.getPredecessorTask() is not None
            )

        succ_str = ""
        if successors:
            succ_str = ", ".join(
                str(rel.getSuccessorTask().getID()) for rel in successors if rel.getSuccessorTask() is not None
            )

        res_str = ""
        if resources:
            names = [str(a.getResource().getName()) for a in resources if a.getResource() is not None and a.getResource().getName() is not None]
            res_str = ", ".join(n for n in names if n)

        tasks.append({
            "id": task.getID().intValue() if task.getID() is not None else None,
            "uid": task.getUniqueID().intValue() if task.getUniqueID() is not None else None,
            "name": name,
            "level": (outline_level.intValue() - 1) if outline_level is not None else 0,
            "wbs": str(wbs) if wbs is not None else "",
            "start": fmt_date(start),
            "finish": fmt_date(finish),
            "duration": fmt_duration(duration),
            "pct": float(pct) if pct is not None else 0.0,
            "summary": bool(task.getSummary()),
            "milestone": bool(task.getMilestone()),
            "critical": bool(task.getCritical()),
            "predecessors": pred_str,
            "successors": succ_str,
            "resources": res_str,
            "cost": float(cost) if cost is not None else 0.0,
            "notes": str(notes) if notes is not None else "",
            "baseline_start": fmt_date(task.getBaselineStart()),
            "baseline_finish": fmt_date(task.getBaselineFinish()),
            "baseline_duration": fmt_duration(task.getBaselineDuration()),
            "total_slack": fmt_duration(task.getTotalSlack()),
            "free_slack": fmt_duration(task.getFreeSlack()),
            "actual_start": fmt_date(task.getActualStart()),
            "actual_duration": fmt_duration(task.getActualDuration()),
            "remaining_duration": fmt_duration(task.getRemainingDuration()),
            "constraint_type": fmt_enum(task.getConstraintType()),
            "priority": priority.getValue() if priority is not None else None,
            "task_type": fmt_enum(task.getType()),
        })

    return tasks


def find_mpp_files(data_dir, tmp_root):
    """Devuelve una lista de (label, ruta_mpp) a partir de .mpp sueltos y .zip en data_dir."""
    found = []
    for fname in sorted(os.listdir(data_dir)):
        fpath = os.path.join(data_dir, fname)
        if not os.path.isfile(fpath):
            continue
        lower = fname.lower()
        if lower.endswith(".mpp"):
            label = os.path.splitext(fname)[0]
            found.append((label, fpath))
        elif lower.endswith(".zip"):
            label = os.path.splitext(fname)[0]
            extract_dir = os.path.join(tmp_root, label)
            os.makedirs(extract_dir, exist_ok=True)
            with zipfile.ZipFile(fpath) as z:
                for member in z.namelist():
                    if member.lower().endswith(".mpp"):
                        z.extract(member, extract_dir)
                        found.append((label, os.path.join(extract_dir, member)))
    return found


def main():
    if len(sys.argv) != 3:
        print("Uso: python extract.py <directorio_datos> <directorio_salida>")
        sys.exit(1)

    data_dir, out_dir = sys.argv[1], sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)

    tmp_root = tempfile.mkdtemp(prefix="mpxj_extract_")
    mpp_files = find_mpp_files(data_dir, tmp_root)

    if not mpp_files:
        print(f"No se encontraron archivos .mpp (ni sueltos ni dentro de .zip) en {data_dir}", file=sys.stderr)
        sys.exit(1)

    jpype.startJVM(classpath=jpype.getClassPath())
    from org.mpxj.reader import UniversalProjectReader
    reader = UniversalProjectReader()

    manifest = []
    used_slugs = set()

    for label, mpp_path in mpp_files:
        slug = slugify(label)
        base_slug, n = slug, 2
        while slug in used_slugs:
            slug = f"{base_slug}-{n}"
            n += 1
        used_slugs.add(slug)

        print(f"Procesando '{label}' ({mpp_path}) -> {slug}.json")
        tasks = extract_tasks(reader, mpp_path)

        with open(os.path.join(out_dir, slug + ".json"), "w", encoding="utf-8") as f:
            json.dump(tasks, f, ensure_ascii=False)

        first = tasks[0] if tasks else {}
        manifest.append({
            "slug": slug,
            "label": label,
            "taskCount": len(tasks),
            "start": first.get("start"),
            "finish": first.get("finish"),
        })

        print(f"  {len(tasks)} tareas")

    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False)

    for extra_file in ("contractors.json", "reasons.json", "units.json"):
        extra_path = os.path.join(data_dir, extra_file)
        if os.path.isfile(extra_path):
            shutil.copyfile(extra_path, os.path.join(out_dir, extra_file))
            print(f"Copiado {extra_file}")

    print(f"Generados {len(manifest)} proyecto(s) en {out_dir}")

    jpype.shutdownJVM()


if __name__ == "__main__":
    main()
