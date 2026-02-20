import { useEffect, useId, useRef, useState } from 'react'

type StatHeaderTermProps = {
  abbreviation: string
  definition: string
}

export const StatHeaderTerm = ({
  abbreviation,
  definition,
}: StatHeaderTermProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const termRef = useRef<HTMLSpanElement | null>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null
      if (
        !termRef.current ||
        (targetNode && termRef.current.contains(targetNode))
      ) {
        return
      }

      setIsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <span className={`stat-term${isOpen ? ' open' : ''}`} ref={termRef}>
      <button
        type="button"
        className="stat-term-trigger"
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={`${abbreviation}: ${definition}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        {abbreviation}
      </button>
      <span id={tooltipId} role="tooltip" className="stat-term-tooltip">
        {abbreviation} = {definition}
      </span>
    </span>
  )
}
