'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import SortableCard from './SortableCard'

export type ColumnId = 'left' | 'center' | 'right'

export interface CardDef {
  id: string
  defaultColumn: ColumnId
}

interface ColumnLayout {
  left: string[]
  center: string[]
  right: string[]
}

interface DashboardGridProps {
  /** Card definitions with default placements */
  cards: CardDef[]
  /** Map of card ID → ReactNode to render */
  cardContent: Record<string, ReactNode>
  /** Whether drag-and-drop is enabled */
  isEditing: boolean
  /** User ID for localStorage key */
  userId: string | null
  /** Animation class */
  animClass?: string
}

const STORAGE_KEY_PREFIX = 'dashboard_layout_'

function getDefaultLayout(cards: CardDef[]): ColumnLayout {
  const layout: ColumnLayout = { left: [], center: [], right: [] }
  for (const card of cards) {
    layout[card.defaultColumn].push(card.id)
  }
  return layout
}

function loadLayout(userId: string | null, cards: CardDef[]): ColumnLayout {
  if (!userId) return getDefaultLayout(cards)
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + userId)
    if (saved) {
      const parsed = JSON.parse(saved) as ColumnLayout
      // Validate: ensure all card IDs are present
      const allIds = new Set(cards.map(c => c.id))
      const savedIds = new Set([...parsed.left, ...parsed.center, ...parsed.right])
      const missing = [...allIds].filter(id => !savedIds.has(id))
      if (missing.length === 0) return parsed
    }
  } catch { /* ignore */ }
  return getDefaultLayout(cards)
}

function saveLayout(userId: string | null, layout: ColumnLayout) {
  if (!userId) return
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + userId, JSON.stringify(layout))
  } catch { /* ignore */ }
}

function findColumn(layout: ColumnLayout, cardId: string): ColumnId | null {
  if (layout.left.includes(cardId)) return 'left'
  if (layout.center.includes(cardId)) return 'center'
  if (layout.right.includes(cardId)) return 'right'
  return null
}

export default function DashboardGrid({ cards, cardContent, isEditing, userId, animClass }: DashboardGridProps) {
  const [layout, setLayout] = useState<ColumnLayout>(() => loadLayout(userId, cards))
  const [activeId, setActiveId] = useState<string | null>(null)

  // Re-load when userId changes
  useEffect(() => {
    setLayout(loadLayout(userId, cards))
  }, [userId, cards])

  // Save on every layout change (only when editing)
  const persistLayout = useCallback((newLayout: ColumnLayout) => {
    setLayout(newLayout)
    saveLayout(userId, newLayout)
  }, [userId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeCol = findColumn(layout, active.id as string)
    // over can be a card ID or a column droppable ID
    let overCol = findColumn(layout, over.id as string)

    // If over is a column droppable (left/center/right)
    if (!overCol && ['left', 'center', 'right'].includes(over.id as string)) {
      overCol = over.id as ColumnId
    }

    if (!activeCol || !overCol || activeCol === overCol) return

    // Move card to new column
    setLayout(prev => {
      const newLayout = { ...prev }
      newLayout[activeCol] = prev[activeCol].filter(id => id !== active.id)
      // Insert at the position of the over item, or at the end
      const overIndex = prev[overCol!].indexOf(over.id as string)
      if (overIndex >= 0) {
        newLayout[overCol!] = [...prev[overCol!]]
        newLayout[overCol!].splice(overIndex, 0, active.id as string)
      } else {
        newLayout[overCol!] = [...prev[overCol!], active.id as string]
      }
      return newLayout
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeCol = findColumn(layout, active.id as string)
    const overCol = findColumn(layout, over.id as string)

    if (activeCol && overCol && activeCol === overCol) {
      // Reorder within same column
      const oldIndex = layout[activeCol].indexOf(active.id as string)
      const newIndex = layout[activeCol].indexOf(over.id as string)
      if (oldIndex !== newIndex) {
        const newLayout = { ...layout }
        newLayout[activeCol] = arrayMove(layout[activeCol], oldIndex, newIndex)
        persistLayout(newLayout)
        return
      }
    }

    // Cross-column move already handled in dragOver, just persist
    persistLayout(layout)
  }

  const renderColumn = (columnId: ColumnId, span: string) => {
    const cardIds = layout[columnId]
    return (
      <div className={`${span} space-y-4`}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy} id={columnId}>
          {cardIds.map(id => (
            <SortableCard key={id} id={id} isEditing={isEditing}>
              {cardContent[id] || null}
            </SortableCard>
          ))}
        </SortableContext>
      </div>
    )
  }

  const activeContent = activeId ? cardContent[activeId] : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${animClass || ''}`}>
        {renderColumn('left', 'lg:col-span-5')}
        {renderColumn('center', 'lg:col-span-4')}
        {renderColumn('right', 'lg:col-span-3')}
      </div>

      <DragOverlay>
        {activeContent ? (
          <div className="opacity-90 shadow-2xl rounded-xl ring-2 ring-green-400 scale-[1.02] pointer-events-none">
            {activeContent}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
