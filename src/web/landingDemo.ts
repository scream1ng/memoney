// Looping "how it works" demo for the web landing page: real app markup inside a scaled phone frame.
// Ported from plan/landing-page.html. Display only; nothing here touches app state.

const P: Record<string, string> = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  pen: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  brief: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  cal: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  note: '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
  clip: '<path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/>',
  spin: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
}
const i = (n: string, s = 22, w = 2, cls = '') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" class="${cls}" aria-hidden="true">${P[n]}</svg>`
const bars = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>'
const CAT: Record<string, [string, string, string]> = { food: ['Food', '#c93400', 'food'], shopping: ['Shopping', '#ff2d55', 'bag'], transport: ['Transport', '#007aff', 'car'], salary: ['Salary', '#248a3d', 'brief'] }
const receipt = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="84"><rect width="64" height="84" fill="#e9e6df"/><rect x="10" y="6" width="44" height="74" fill="#fff"/><g fill="#c6c6c8"><rect x="16" y="14" width="32" height="4"/><rect x="16" y="26" width="22" height="3"/><rect x="42" y="26" width="6" height="3"/><rect x="16" y="33" width="18" height="3"/><rect x="42" y="33" width="6" height="3"/><rect x="16" y="40" width="24" height="3"/><rect x="42" y="40" width="6" height="3"/></g><rect x="16" y="54" width="14" height="5" fill="#6c6c70"/><rect x="36" y="54" width="12" height="5" fill="#6c6c70"/></svg>')

type Entry = { day: string; cat: string; note: string; amt: number; inc?: boolean; merchant?: string; photo?: boolean; heard?: string }

const base: Entry[] = [
  { day: 'Yesterday', cat: 'food', note: 'ข้าวมันไก่', amt: 60 },
  { day: 'Yesterday', cat: 'transport', note: 'BTS', amt: 45 },
  { day: 'Oct 1', cat: 'salary', note: 'October', amt: 18000, inc: true },
]
const money = (n: number) => '฿' + n.toLocaleString('en-US')
const txRow = (t: Entry, isNew: boolean) => `<div class="swipe"><button class="row tx${isNew ? ' new' : ''}"><span class="cat" style="background:${CAT[t.cat][1]}">${i(CAT[t.cat][2])}</span><div class="grow"><div>${t.merchant || CAT[t.cat][0]}</div>${t.note ? `<div class="sub">${t.note}</div>` : ''}</div>${t.photo ? i('clip', 14, 2, 'clip-mark') : ''}<span class="num ${t.inc ? 'inc' : 'exp'}">${t.inc ? '+' : '−'}${money(t.amt)}</span></button></div>`

function homeHtml(txs: Entry[], newest?: Entry) {
  const income = txs.filter((t) => t.inc).reduce((s, t) => s + t.amt, 0), expense = txs.filter((t) => !t.inc).reduce((s, t) => s + t.amt, 0)
  const days = [...new Set(txs.map((t) => t.day))]
  return `<main class="screen">
    <div class="row between month"><h1>October</h1><div class="row"><button class="icon-btn">${i('left', 20)}</button><button class="icon-btn">${i('right', 20)}</button></div></div>
    <section class="summary"><div class="num balance">${money(income - expense)}</div><div class="io"><span class="num inc">+${money(income)}</span><span class="num exp">−${money(expense)}</span></div></section>
    <div class="row between period-controls"><div class="seg filter"><button class="n" aria-pressed="true">${i('list', 18)}</button><button class="e" aria-pressed="false">${i('minus', 18, 2.6)}</button><button class="i" aria-pressed="false">${i('plus', 18, 2.6)}</button></div><div class="seg period-toggle"><button aria-pressed="false">Week</button><button aria-pressed="true">Month</button></div></div>
    <div class="card list">${days.map((d) => `<section><div class="day">${d}</div>${txs.filter((t) => t.day === d).map((t) => txRow(t, t === newest)).join('')}</section>`).join('')}</div>
  </main>`
}
const dock = `<nav class="dock"><div class="glass tabs"><a class="active">${i('house')}</a><a>${bars}</a><a>${i('settings')}</a></div><button class="glass fab" id="fab">${i('plus', 28, 2.4)}</button>
  <div id="menu" hidden><div class="menu-shade"></div><div class="quick-actions"><button class="action"><span class="action-label">Manual</span><span class="round">${i('pen', 24)}</span></button><button class="action" id="act-camera"><span class="action-label">Camera</span><span class="round">${i('camera', 24)}</span></button><button class="action" id="act-voice"><span class="action-label">Voice</span><span class="round">${i('mic', 24)}</span></button></div></div></nav>`
const voice = `<dialog open class="modal-dialog voice-mode rec" id="voice" hidden><div class="vm-title">Voice entry</div><div class="vm-center"><div class="orb-wrap"><div class="orb" id="orb"></div></div><div class="vm-status" id="vm-status"><span class="voice-dot"></span>Listening</div><p class="vm-guide" id="vm-guide">Say the amount and what it was for</p></div><div class="vm-bar"><button class="vm-round finish" id="vm-finish">${i('check', 26, 2.4)}</button><button class="vm-round cancel">${i('x', 26, 2.4)}</button></div></dialog>`
const dot = '<span class="hint-mark"></span>'
const header = `<div class="handle"><div class="grab"></div><div class="row between"><label class="chip">${i('cal', 16)}Today</label><div class="seg"><button class="e" aria-pressed="true">${i('minus', 18, 2.6)}</button><button class="i" aria-pressed="false">${i('plus', 18, 2.6)}</button></div><button class="icon-btn">${i('x', 20)}</button></div></div>`
const busy = (img: boolean) => `<div class="ai-panel">${img ? `<img class="thumb" src="${receipt}" alt="">` : ''}${i('spin', 36, 2, 'spin accent')}<div class="lbl">${img ? 'Reading receipt…' : 'Reading what you said…'}</div><div class="sub">You can review the details before saving.</div></div>`
function review(e: Entry) {
  return `${e.photo ? `<div class="review-source">From your receipt · ${e.merchant} · ${dot} = our guess, tap to change</div>` : `<div class="heard">“${e.heard}”</div>`}
    <button class="review-amount"><small>Amount ${dot}</small><div class="amount num exp">${money(e.amt)}</div><span class="edit-cue">Tap to edit</span></button>
    <button class="review-category"><span class="cat" style="background:${CAT[e.cat][1]}">${i(CAT[e.cat][2], 24)}</span><span class="value"><small>Category</small><strong>${CAT[e.cat][0]}</strong></span>${dot}${i('right', 16, 2, 'chev')}</button>
    <label class="review-row"><span class="tile note">${i('note')}</span><span class="value"><small>Note</small><input value="${e.note}" tabindex="-1"></span>${dot}</label>
    ${e.photo ? `<button class="review-row"><img class="tile" src="${receipt}" alt=""><span class="value"><small>Receipt</small><strong>View photo</strong></span>${i('right', 16, 2, 'chev')}</button>` : ''}
    <button class="review-save" id="save">Save entry</button>`
}

const VOICE: Entry = { day: 'Today', cat: 'food', note: 'ชานม', amt: 26, heard: 'ชานมยี่สิบหกบาท' }
const SCAN: Entry = { day: 'Today', cat: 'shopping', note: 'ของใช้ในบ้าน', amt: 349, merchant: "Lotus's", photo: true }


const report = (txs: Entry[]) => {
  const inc = txs.filter((t) => t.inc).reduce((s, t) => s + t.amt, 0), exp = txs.filter((t) => !t.inc).reduce((s, t) => s + t.amt, 0)
  return `<h3>MeMoney report</h3><div class="pm">October 2026 · 1–31 Oct</div>
    <div class="ptot"><div><span class="pm">Income</span><b class="inc">+${money(inc)}</b></div><div><span class="pm">Expense</span><b>−${money(exp)}</b></div><div><span class="pm">Net</span><b>${money(inc - exp)}</b></div></div>
    <b style="font-size:10px">Transactions</b>
    ${txs.map((t) => `<div class="prow"><b>${t.merchant || CAT[t.cat][0]}</b><b class="${t.inc ? 'inc' : ''}">${t.inc ? '+' : '−'}${money(t.amt)}</b><span class="pm">${t.inc ? 'Income' : 'Expense'} · ${t.day} · Receipt: ${t.photo ? 'Yes' : 'No'}</span><span>${t.note}</span></div>`).join('')}
    <div class="paper-actions"><span>${i('printer', 11)}Print</span><span>${i('download', 11)}PDF</span><span>${i('download', 11)}CSV</span></div>`
}

/** Runs the loop until the returned function is called. onStep highlights the matching step (1–4). */
export function startDemo(stage: HTMLElement, onStep: (n: number) => void): () => void {
  const phone = stage.querySelector<HTMLElement>('.wl-phone')!
  const paper = stage.querySelector<HTMLElement>('.wl-paper')!
  let stopped = false
  const timers = new Set<ReturnType<typeof setTimeout>>()
  // every pause checks the stop flag, so a stopped loop never writes into the phone again
  const wait = (ms: number) => new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => { timers.delete(t); if (stopped) reject(new Error('stopped')); else resolve() }, ms)
    timers.add(t)
  })
  const $ = (id: string) => phone.querySelector<HTMLElement>(`#${id}`)!
  let txs = [...base]
  function render(newest?: Entry) {
    phone.innerHTML = homeHtml(txs, newest) + dock + voice + '<div class="sheet-shade" id="shade" hidden></div><dialog open class="modal-dialog glass sheet review-sheet" id="sheet" hidden></dialog><div class="wl-tap" id="tap"></div>'
  }
  async function tap(el: HTMLElement) {
    const t = $('tap'), p = phone.getBoundingClientRect(), r = el.getBoundingClientRect(), s = p.width / 375
    t.style.left = (r.left - p.left + r.width / 2) / s + 'px'
    t.style.top = (r.top - p.top + r.height / 2) / s + 'px'
    t.classList.add('on'); await wait(260)
    el.classList.add('pressed'); await wait(160)
    el.classList.remove('pressed'); t.classList.remove('on'); await wait(200)
  }
  function sheet(html: string) { $('shade').hidden = false; const s = $('sheet'); s.innerHTML = header + html; s.hidden = false }
  function closeSheet() { $('sheet').hidden = true; $('shade').hidden = true }

  async function capture(e: Entry, actionId: string) {
    onStep(1)
    await wait(1100)
    await tap($('fab')); $('fab').classList.add('open'); $('menu').hidden = false
    await wait(700)
    await tap($(actionId)); $('menu').hidden = true; $('fab').classList.remove('open')
    if (!e.photo) {
      $('voice').hidden = false
      const orb = $('orb'), talk = setInterval(() => orb.style.setProperty('--level', Math.random().toFixed(2)), 130)
      try { await wait(2200) } finally { clearInterval(talk) }
      orb.style.setProperty('--level', '0')
      await tap($('vm-finish'))
      const v = $('voice'); v.classList.replace('rec', 'busy'); ($('vm-finish') as HTMLButtonElement).disabled = true
      $('vm-status').textContent = 'Reading what you said…'; $('vm-guide').textContent = 'You can check it before saving'
      await wait(1500)
      v.hidden = true
    } else {
      sheet(busy(true))
      await wait(1900)
    }
    onStep(2)
    sheet(review(e))
    await wait(2600)
    const save = $('save')
    await tap(save); save.textContent = 'Saving…'
    await wait(450)
    closeSheet()
    onStep(3)
    txs = [e, ...txs]; render(e)
    await wait(2400)
  }

  async function showReport() {
    onStep(4)
    paper.innerHTML = report(txs)
    stage.classList.add('report'); paper.hidden = false
    await wait(3600)
    paper.hidden = true; stage.classList.remove('report')
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    render(); sheet(review(VOICE)); onStep(2)
  } else {
    void (async () => {
      for (;;) {
        txs = [...base]; render()
        await capture(VOICE, 'act-voice')
        await capture(SCAN, 'act-camera')
        await showReport()
      }
    })().catch(() => { /* stopped */ })
  }
  return () => {
    stopped = true
    timers.forEach(clearTimeout)
    timers.clear()
  }
}
