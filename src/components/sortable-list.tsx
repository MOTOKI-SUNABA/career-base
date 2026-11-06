"use client";

import { useId, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type UniqueIdentifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface SortableListProps<T extends { id: string }> {
  items: T[];
  label: string;
  className: string;
  disabled?: boolean;
  getLabel: (item: T) => string;
  onMove: (activeId: string, overId: string, visibleIds: string[]) => boolean;
  children: (item: T) => ReactNode;
}

export function SortableList<T extends { id: string }>({ items, label, className, disabled = false, getLabel, onMove, children }: SortableListProps<T>) {
  const id = useId();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [error, setError] = useState("");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const active = items.find((item) => item.id === activeId);
  const itemName = (itemId: UniqueIdentifier) => {
    const item = items.find((value) => value.id === itemId);
    return item ? getLabel(item) : "項目";
  };

  return <DndContext id={id} sensors={sensors} collisionDetection={closestCenter}
    accessibility={{
      screenReaderInstructions: { draggable: "スペースで並べ替えを開始、上下矢印で移動、スペースで確定、Escapeでキャンセルします。" },
      announcements: {
        onDragStart: ({ active }) => `${itemName(active.id)}の並べ替えを開始しました。`,
        onDragOver: ({ over }) => over ? `${itemName(over.id)}の位置に移動します。` : "一覧の外です。",
        onDragEnd: () => "並べ替え操作が終了しました。",
        onDragCancel: () => "並べ替えをキャンセルしました。",
      },
    }}
    onDragStart={({ active }) => { setActiveId(active.id); setError(""); }}
    onDragCancel={() => setActiveId(null)}
    onDragEnd={({ active, over }) => {
      setActiveId(null);
      if (disabled || !over || active.id === over.id) return;
      const saved = onMove(String(active.id), String(over.id), items.map((item) => item.id));
      setError(saved ? "" : "並び順を保存できませんでした。もう一度お試しください。");
    }}>
    {error && <p className="reorder-error" role="alert">{error}</p>}
    <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
      <ul className={className} aria-label={label}>{items.map((item) => <SortableRow key={item.id} id={item.id} label={getLabel(item)} disabled={disabled}>{children(item)}</SortableRow>)}</ul>
    </SortableContext>
    <DragOverlay dropAnimation={null} zIndex={60}>{active ? <div className="sortable-overlay" aria-hidden="true" inert><span className="reorder-handle"><GripVertical size={16} /></span>{children(active)}</div> : null}</DragOverlay>
  </DndContext>;
}

function SortableRow({ id, label, disabled, children }: { id: string; label: string; disabled: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return <li ref={setNodeRef} className={`sortable-row${isDragging ? " is-dragging" : ""}`} style={{ transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null), transition }}
    onMouseDown={(event) => listeners?.onMouseDown(event)}>
    <button type="button" ref={setActivatorNodeRef} className="reorder-handle" {...attributes} onKeyDown={(event) => listeners?.onKeyDown(event)} onTouchStart={(event) => listeners?.onTouchStart(event)}
      onClick={(event) => event.stopPropagation()} disabled={disabled} aria-label={`${label}を並べ替え`} aria-roledescription="並べ替え可能な項目" title="ドラッグして並べ替え"><GripVertical size={16} aria-hidden="true" /></button>
    {children}
  </li>;
}
