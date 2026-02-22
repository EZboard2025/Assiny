'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'

interface SortableCardProps {
  id: string
  isEditing: boolean
  children: ReactNode
}

export default function SortableCard({ id, isEditing, children }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditing })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  if (!isEditing) {
    return <>{children}</>
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-xl ${
        isDragging ? 'ring-2 ring-green-400 shadow-lg' : 'ring-1 ring-dashed ring-gray-300 hover:ring-green-300'
      }`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-200 rounded-full px-2 py-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shadow-sm flex items-center gap-1"
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[9px] text-gray-400 font-medium">Mover</span>
      </div>
      {/* Card content - disable pointer events while dragging to prevent clicks */}
      <div className={isDragging ? 'pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  )
}
