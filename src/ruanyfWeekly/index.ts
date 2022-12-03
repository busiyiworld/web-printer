import buffer2arraybuffer from "buffer-to-arraybuffer"
import fs from "fs-extra"
import { BrowserContext } from "playwright"
import { PrintOption } from "~/types"
import { delay, mergePDF, projectRoot } from "~/utils"

interface Page {
  title: string
  num: number
  year: number
  month: number
}

async function fetchWeeklyPages() {
  const content = (
    await fs.readFile(
      await projectRoot("assets/ruanyf-weekly-outline.md"),
      "utf-8"
    )
  ).toString()
  const data = content.split("\n").reduce(
    (acc, cur) => {
      cur = cur.trim()
      if (cur) {
        const year = cur.replace(/^## (\w{4})$/, "$1")
        if (cur !== year) {
          acc.year = Number(year)
        } else {
          const month = cur.replace(/^\**(.+)月\**$/, "$1")
          if (cur !== month) {
            acc.month =
              [
                "一",
                "二",
                "三",
                "四",
                "五",
                "六",
                "七",
                "八",
                "九",
                "十",
                "十一",
                "十二"
              ].indexOf(month) + 1
          } else if (acc.month && acc.year) {
            const temp = cur.replace(
              /^.+第\s*(\d+?)\s*期.+\[(.+?)\].*$/,
              "$1||$2"
            )
            if (cur !== temp) {
              const [num, title] = temp.split("||")
              acc.pages.push({
                title,
                num: Number(num),
                year: acc.year,
                month: acc.month
              })
            }
          }
        }
      }
      return acc
    },
    { pages: [] as Page[], year: 0, month: 0 }
  )
  return data.pages
    .sort((m, n) => m.num - n.num)
    .map(k => ({
      title: `第 ${k.num} 期：${k.title}`,
      id: `${k.year}/${String(k.month).padStart(2, "0")}/weekly-issue-${k.num}`
    }))
}

export default async function (context: BrowserContext, options?: PrintOption) {
  const home = "https://www.ruanyifeng.com/blog"
  const name = "科技爱好者周刊"
  const pdfs: { buffer: ArrayBuffer; title: string }[] = []
  const page = await context.newPage()
  const pagesInfo = await fetchWeeklyPages()
  for (const info of pagesInfo) {
    await page.goto(`https://www.ruanyifeng.com/blog/${info.id}.html`)
    await delay(700)
    pdfs.push({
      buffer: buffer2arraybuffer(await page.pdf(options)),
      title: info.title
    })
  }
  await page.close()
  const outPath = await projectRoot(`./pdf/${name}.pdf`)
  await fs.writeFile(outPath, await mergePDF(pdfs))
}