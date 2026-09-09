// 数字自适应：.num 超宽时逐级缩小字号，保持单行、不出屏
export function ensureFits(): void {
  const els = document.querySelectorAll<HTMLElement>('.num')
  els.forEach((el) => {
    const base = el.dataset.fitBase || String(parseFloat(window.getComputedStyle(el).fontSize) || 14)
    el.dataset.fitBase = base
    el.style.fontSize = base + 'px'

    // 向上找到真正溢出的容器（最多 5 层）
    let anc: HTMLElement | null = el.parentElement
    let target: HTMLElement | null = null
    for (let i = 0; i < 5 && anc; i++) {
      if (anc.scrollWidth > anc.clientWidth + 1) { target = anc; break }
      anc = anc.parentElement
    }
    if (!target) return

    let fs = parseFloat(base)
    const min = 9
    let guard = 0
    while (fs > min && guard++ < 30 && target.scrollWidth > target.clientWidth + 1) {
      fs -= 1
      el.style.fontSize = fs + 'px'
    }
  })
}
