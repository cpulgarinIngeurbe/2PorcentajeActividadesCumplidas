"""Extrae tareas de un archivo .mpp usando MPXJ (via JPype) y las guarda como JSON.

Uso:
    python extract.py <ruta_al_mpp> <ruta_salida_json>
"""
import sys
import json
from datetime import datetime

import jpype
import mpxj  # debe importarse antes de startJVM: registra el jar de MPXJ en el classpath
import jpype.imports


def fmt_date(java_date):
    if java_date is None:
        return None
    return str(java_date).split("T")[0] if "T" in str(java_date) else str(java_date)[:10]


def main():
    if len(sys.argv) != 3:
        print("Uso: python extract.py <ruta_al_mpp> <ruta_salida_json>")
        sys.exit(1)

    mpp_path, out_path = sys.argv[1], sys.argv[2]

    jpype.startJVM(classpath=jpype.getClassPath())

    from org.mpxj.reader import UniversalProjectReader

    reader = UniversalProjectReader()
    project = reader.read(mpp_path)

    tasks = []
    for task in project.getTasks():
        if task.getUniqueID() == 0 and task.getName() is None:
            continue

        name = task.getName()
        outline_level = task.getOutlineLevel()
        wbs = task.getWBS()
        start = task.getStart()
        finish = task.getFinish()
        duration = task.getDuration()
        pct = task.getPercentageComplete()
        predecessors = task.getPredecessors()
        resources = task.getResourceAssignments()
        cost = task.getCost()
        notes = task.getNotes()

        pred_str = ""
        if predecessors:
            pred_str = ", ".join(
                str(p.getPredecessorTask().getID()) for p in predecessors if p.getPredecessorTask() is not None
            )

        res_str = ""
        if resources:
            names = [a.getResource().getName() for a in resources if a.getResource() is not None]
            res_str = ", ".join(n for n in names if n)

        tasks.append({
            "id": task.getID().intValue() if task.getID() is not None else None,
            "uid": task.getUniqueID().intValue() if task.getUniqueID() is not None else None,
            "name": name,
            "level": (outline_level.intValue() - 1) if outline_level is not None else 0,
            "wbs": str(wbs) if wbs is not None else "",
            "start": fmt_date(start),
            "finish": fmt_date(finish),
            "duration": str(duration) if duration is not None else "",
            "pct": float(pct) if pct is not None else 0.0,
            "summary": bool(task.getSummary()),
            "milestone": bool(task.getMilestone()),
            "critical": bool(task.getCritical()),
            "predecessors": pred_str,
            "resources": res_str,
            "cost": float(cost) if cost is not None else 0.0,
            "notes": notes or "",
        })

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(tasks, f, ensure_ascii=False)

    print(f"Extraídas {len(tasks)} tareas -> {out_path}")

    jpype.shutdownJVM()


if __name__ == "__main__":
    main()
