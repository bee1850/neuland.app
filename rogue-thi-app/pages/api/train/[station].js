import cheerio from 'cheerio'
import { URLSearchParams } from 'url'
import AsyncMemoryCache from '../../../lib/cache/async-memory-cache'

const CACHE_TTL = 60 * 1000
const CACHE_HEADER = 'max-age=60'
const URL = 'https://mobile.bahn.de/bin/mobil/bhftafel.exe/dox?ld=43120&protocol=https:&rt=1&use_realtime_filter=1&'
const STATIONS = {
  nord: 'Ingolstadt Nord#008003076',
  hbf: 'Ingolstadt Hbf',
  audi: 'Ingolstadt Audi#008003074'
}

const cache = new AsyncMemoryCache({ ttl: CACHE_TTL })

function dateFromTimestring (str) {
  const [, hourStr, minuteStr] = str.match(/(\d\d):(\d\d)/)
  const hour = parseInt(hourStr)
  const minute = parseInt(minuteStr)
  const now = new Date()

  if (now.getHours() > hour || (now.getHours() === hour && now.getMinutes() > minute)) {
    console.log(now.getHours(), hour, now.getMinutes(), minute)
    now.setDate(now.getDate() + 1)
  }

  now.setHours(hour)
  now.setMinutes(minute)
  return now
}

function sendJson (res, code, value) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', CACHE_HEADER)
  res.end(JSON.stringify(value))
}

export default async function handler (req, res) {
  const station = req.query.station
  if (!STATIONS.hasOwnProperty(station)) {
    sendJson(res, 400, 'Unknown station')
    return
  }

  try {
    const data = await cache.get(station, async () => {
      const now = new Date()
      const pad2 = x => x.toString().padStart(2, '0')

      const paramObj = {
        input: STATIONS[station],
        inputRef: '#',
        date: `+${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`,
        time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`, //
        productsFilter: '1111101000000000', // "Nur Bahn"
        REQTrain_name: '',
        maxJourneys: 10,
        start: 'Suchen',
        boardType: 'Abfahrt',
        ao: 'yes'
      }

      const params = new URLSearchParams()
      for (const key in paramObj) {
        params.append(key, paramObj[key])
      }

      const resp = await fetch(URL, {
        method: 'POST',
        body: params
      })
      const body = await resp.text()
      if (resp.status !== 200) {
        throw new Error('Train data not available')
      }

      const $ = cheerio.load(body)
      const departures = $('.sqdetailsDep').map((i, el) => {
        const spans = $(el).find('span')
        const planned = $(spans[1]).text().trim()
        const actual = $(spans[2]).text().trim() || planned
        const text = $(el).text().trim()
        return {
          name: $(spans[0]).text().trim().replace(/\s+/g, ' '),
          destination: text.match(/>>\n(.*)/)[1],
          plannedTime: dateFromTimestring(planned),
          actualTime: dateFromTimestring(actual),
          plattform: parseInt(text.substr(text.length - 2)),
          url: $(el).find('a').attr('href')
        }
      })

      return Array.from(departures)
    })

    sendJson(res, 200, data)
  } catch (e) {
    sendJson(res, 500, e.message)
  }
}
