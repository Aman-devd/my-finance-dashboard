// 数字自适应：.num 超宽时逐级缩小字号，保持单行、不出屏
export function ensureFits(): void {
  const els = document.querySelectorAll<HTMLElement>('.num')
  els.forEach((el) => {
    const base = el.dataset.fitBase || String(parseFloat(window.getComputedStyle(el).fontSize) || 14)
    el.dataset.fitBase = base
    // 支持 data-fit-min 属性设置最小字号，默认 9px
    const min = parseFloat(el.dataset.fitMin || '9')

    // 向上找到真正溢出的容器（最多 5 层）
    let anc: HTMLElement | null = el.parentElement
    let target: HTMLElement | null = null
    for (let i = 0; i < 5 && anc; i++) {
      if (anc.scrollWidth > anc.clientWidth + 1) { target = anc; break }
      anc = anc.parentElement
    }
    if (!target) {
      // 不溢出时，如果当前字号小于基础字号，恢复到基础字号
      const current = parseFloat(window.getComputedStyle(el).fontSize)
      if (current < parseFloat(base)) {
        el.style.fontSize = base + 'px'
      }
      return
    }

    // 从当前字号开始缩小，不要先重置为基础字号（避免先大后小的闪烁）
    let fs = parseFloat(window.getComputedStyle(el).fontSize)
    let guard = 0
    while (fs > min && guard++ < 30 && target.scrollWidth > target.clientWidth + 1) {
      fs -= 1
      el.style.fontSize = fs + 'px'
    }
  })
}
