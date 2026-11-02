const fs = require('node:fs')
const path = require('node:path')

// The App SVG component and native PNGs use the same Pokémon-themed paths.
const shapes = require('../../core/src/ui/tab-icons.json')

exports.createTabBarItems = async function createTabBarItems(sharp, output, pages, labels) {
  fs.mkdirSync(output, { recursive: true })
  return Promise.all(pages.map(async (page, index) => {
    if (!shapes[page]) throw Error(`Missing tab icon: ${page}`)
    for (const [state, color] of [['normal', '#93a4b5'], ['selected', '#7fcec0']]) {
      const paths = shapes[page].map(d => `<path d="${d}"/>`).join('')
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
      await sharp(Buffer.from(svg)).png().toFile(path.join(output, `${page}-${state}.png`))
    }
    return {
      pagePath: `pages/${page}/index`, text: labels[index],
      iconPath: `assets/tabbar/${page}-normal.png`,
      selectedIconPath: `assets/tabbar/${page}-selected.png`,
    }
  }))
}
