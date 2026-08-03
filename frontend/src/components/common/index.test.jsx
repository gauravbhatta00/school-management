import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatCard, StatusBadge, ErrorAlert, Modal } from './index'

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard label="Total Students" value={42} />)
    expect(screen.getByText('Total Students')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('falls back to an em dash when value is nullish', () => {
    render(<StatCard label="Fee Collected" value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it('maps a known status to its badge class', () => {
    render(<StatusBadge status="present" />)
    expect(screen.getByText('present')).toHaveClass('badge-green')
  })

  it('falls back to badge-gray for an unknown status', () => {
    render(<StatusBadge status="unknown-status" />)
    expect(screen.getByText('unknown-status')).toHaveClass('badge-gray')
  })
})

describe('ErrorAlert', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<ErrorAlert message="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the message when provided', () => {
    render(<ErrorAlert message="Invalid credentials." />)
    expect(screen.getByText('Invalid credentials.')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}} title="Test">
        content
      </Modal>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders its title and children when open, and calls onClose', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Add Student">
        <p>form here</p>
      </Modal>
    )
    expect(screen.getByText('Add Student')).toBeInTheDocument()
    expect(screen.getByText('form here')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
