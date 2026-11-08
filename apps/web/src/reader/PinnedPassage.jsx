import { useEffect, useRef, useState } from 'react'

// The same selection is used by the compact summary and the complete reader.
export default function PinnedPassage({ selection, currentMs, formatClock, onReplay, onTranscript, onUnpin, onSelectRelated, floating = false, onHeight }) {
  const dialog = useRef(null)
  const bar = useRef(null)
  const reminder = useRef(null)
  const restoreFocus = useRef(true)
  const [showReminder, setShowReminder] = useState(false)
  const [reading, setReading] = useState(false)
  const fallback = useRef(null)
  const opener = useRef(null)
  const generation = useRef(0)
  const [copy, setCopy] = useState(null)
  useEffect(() => { generation.current++; setCopy(null) }, [selection?.key])
  useEffect(() => () => { generation.current++ }, [])
  useEffect(() => {
    if (!floating) return
    const update = () => setShowReminder(Boolean(selection && bar.current?.getBoundingClientRect().bottom < 0 && !document.querySelector('dialog:modal')))
    const observer = new MutationObserver(update)
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => { observer.disconnect(); window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [floating, selection])
  useEffect(() => {
    if (!onHeight) return
    if (!showReminder || !reminder.current) { onHeight(0); return }
    const observer = new ResizeObserver(() => onHeight(reminder.current?.getBoundingClientRect().height || 0))
    observer.observe(reminder.current)
    return () => { observer.disconnect(); onHeight(0) }
  }, [onHeight, showReminder])
  useEffect(() => { if (copy?.manual) { fallback.current?.focus(); fallback.current?.select(); if(fallback.current) fallback.current.scrollTop = 0 } }, [copy])
  async function copyValue(kind) {
    const value = kind === 'text' ? selection.text : kind === 'link' ? selection.url : selection.citation
    const request = ++generation.current
    const label = kind === 'text' ? 'Passage' : kind === 'link' ? 'Passage link' : 'Passage citation'
    try {
      await navigator.clipboard.writeText(value)
      if (request === generation.current) setCopy({ label, message: `${label} copied.` })
    } catch {
      if (request === generation.current) setCopy({ label, value, manual: true, message: `Select and copy the complete ${label.toLowerCase()} below.` })
    }
  }
  function read(event) { restoreFocus.current = true; opener.current = event.currentTarget; setCopy(null); setReading(true); dialog.current.showModal() }
  function close() { dialog.current.close() }
  const choices = selection?.relatedChoices || []
  const choiceIndex = choices.findIndex(choice => (choice.key && choice.key === selection?.key) || (choice.id && choice.id === selection?.clipId) || (choice.startMs === selection?.startMs && choice.endMs === selection?.endMs))
  const readLabel = 'Read full passage'
  const readButton = <button className="reader-read" type="button" onClick={read}>{readLabel}</button>
  const actions = () => <div className="reader-actions">

    <div className="reader-action-navigation"><button type="button" onClick={onReplay}>Replay</button>
    <button type="button" onClick={() => { restoreFocus.current = false; if (dialog.current.open) close(); onTranscript?.() }}>Transcript</button>
    </div><div className="reader-action-copy"><button type="button" disabled={!selection?.text} onClick={() => copyValue('text')}>Copy passage</button>
    <button className="reader-copy-citation" type="button" disabled={!selection?.citation} onClick={() => copyValue('citation')}>Copy citation</button>
    <button type="button" disabled={!selection?.url} onClick={() => copyValue('link')}>Copy passage link</button></div>
  </div>
  const status = () => copy ? <div className="reader-copy-status"><p role="status">{copy.message}</p>{copy.manual ? <textarea ref={fallback} readOnly aria-label={`Copy ${copy.label.toLowerCase()} manually`} value={copy.value} /> : null}</div> : null
  const compactAttribution = selection?.participantPairs?.length ? selection.participantPairs.map(pair => `${pair.name} · ${pair.date || 'Date unavailable'}`).join('; ') : selection?.attribution
  const metadata = selection ? <><strong>{selection.title}</strong><span>Pinned · {formatClock(selection.startMs)}–{formatClock(selection.endMs)} · Timeline: {compactAttribution}</span></> : null
  return <>
    <section ref={bar} className={`reader-selection${floating ? ' reader-inline-passage' : ''}`} aria-label="Selected passage">
      {selection ? <>
        <div className="reader-selection-meta"><div>{metadata}{readButton}</div><button className="reader-unpin" type="button" onClick={onUnpin}>Unpin</button></div>
        <div className="reader-passage-preview" aria-label="Passage preview">{selection.text || 'This passage has no published transcript.'}</div>
        {actions()}{!reading ? status() : null}
      </> : <><strong>No passage selected</strong><p>Choose an annotation, clip or transcript line to pin a passage.</p></>}
    </section>
    {showReminder && selection ? <aside ref={reminder} className="reader-reminder" aria-label="Pinned passage reminder"><span><strong>{selection.title}</strong><span>{formatClock(selection.startMs)}–{formatClock(selection.endMs)}</span></span><button type="button" onClick={read}>Read passage</button></aside> : null}
    <dialog ref={dialog} className="reader-dialog reader-passage" aria-label="Full recorded passage" onClose={() => { setReading(false); setCopy(null); if (restoreFocus.current) (opener.current?.isConnected ? opener.current : bar.current?.querySelector('.reader-read'))?.focus({ preventScroll: true }) }}>
      <header><h2>Recorded passage</h2><button type="button" autoFocus onClick={close}>Close</button></header>
      {selection ? <div className="reader-dialog-body"><div className="reader-full-meta">{metadata}<button type="button" onClick={() => { close(); onUnpin() }}>Unpin</button></div>
        <blockquote tabIndex={0}>{selection.text || 'This passage has no published transcript.'}</blockquote>
        <section className="reader-citation-tools" aria-label="Passage citation and navigation">
          {actions()}{reading ? status() : null}
          {selection.provenance?.qualification ? <p>{selection.provenance.qualification}</p> : null}
          {selection.relatedChoices?.length && onSelectRelated ? <label>Recorded interpretations of this part<select aria-label="Recorded interpretations of this part" value={choiceIndex >= 0 ? (choices[choiceIndex].key || choices[choiceIndex].id) : ''} onChange={event => onSelectRelated(event.target.value)}>{choiceIndex < 0 ? <option value="">Choose passage</option> : null}{choices.map(choice => <option key={choice.key || choice.id} value={choice.key || choice.id}>{choice.title} · {formatClock(choice.startMs)}–{formatClock(choice.endMs)}{choice.participantPairs?.length ? ` · ${choice.participantPairs.map(pair => `${pair.name} · ${pair.date || 'Date unavailable'}`).join('; ')}` : ''}</option>)}</select></label> : null}
        </section></div> : <p>No passage selected.</p>}
    </dialog>
  </>
}
