const QUERY = 'https://www.allhomes.com.au/ah/act/rent-residential/belconnen/11244512/listed-date?datetype=last_7_days'
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')
const resolve = require('url').resolve

// TESTING CMD:
// `NO_HEADLESS=1 node -e "require('./fetch-raw').fetchList('https://www.allhomes.com.au/ah/act/rent-residential/canberra/1039112/listed-date').then(r=>console.table(r), e=>console.error(e))"`

const nop = () => {}

async function openAndWait(url) {
    let launchOpts = {
        headless: process.env['NO_HEADLESS'] ? false : true,
        args: [
            ...(
                process.env['IS_DOCKER'] || process.getuid() === 0
                ? ['--no-sandbox', '--disable-setuid-sandbox']
                : []
            )
        ]
    }
    const timeout = parseInt(process.env['TIMEOUT'], 10) || 30000
    const browser = await puppeteer.launch(launchOpts)
    const page = await browser.newPage()
    await page.goto(url, { timeout, waitUntil: 'networkidle2' }).then(nop, nop)
    page.destroy = () => browser.close()
    return page
}

function $trim(str) {
    return str.trim().replace(/\s+/g, ' ')
}

function extractListings(html, baseUrl = 'https://www.allhomes.com.au/') {
    const $ = cheerio.load(html)
    const listings = $('.allhomes-new-listings__row').map((idx, el) => {
        const $2 = (...args) => $(el).find(...args)
        const _price = $trim($2('.allhomes-search-listing-card__details-price-main').text()).replace(/,/g, '').match(/\d+/)
        let features = $2('.allhomes-search-listing-card__details-features')
        // rewrite features into healthy css
        $(features)
            .css('display', 'flex')
            .css('flex-direction', 'row')
            .css('align-items', 'center')
            .css('justify-content', 'flex-start')
            .css('flex-wrap', 'nowrap');
        $(features).prepend(`<div class="apt-cron-price">$${ _price || '?' }</div>`)    // prepend price
        $(features).find('.apt-cron-price')
            .css('font-weight', 'bolder')
            .css('margin-right', '3ch')
        $(features).find('.allhomes-search-listing-card__details-features-type')
            .css('color', '#555555')
            .css('margin-right', '2ch');
        $(features).find('.allhomes-search-listing-card__details-features-item')
            .css('display', 'inline-flex')
            .css('flex-direction', 'row')
            .css('align-items', 'center')
            .css('justify-content', 'flex-start')
            .css('margin-right', '1.25ch')
        $(features).find('.allhomes-search-listing-card__details-features-item-value')
            .css('margin-right', '0.25ch')
        $(features).find('.allhomes-search-listing-card__details-features-item-icon-container')
            .css('width' ,'1em')
            .css('height' ,'1em')
            .css('overflow', 'hidden')
            .css('color', '#888888')
        $(features).find('.allhomes-search-listing-card__details-features-eer').remove()

        return {
            href: resolve(baseUrl, $2('a').attr('href')),
            thumbHref: $2('.allhomes-search-listing-card__image img').attr('src'),
            summary: $trim($2('.allhomes-search-listing-card__details-address meta[itemprop="name"]').attr('content')),
            price: _price ? Number(_price) : null,
            features_html: cheerio.load('<div></div>')('div').append(features).html()
        }
    }).get()

    return listings
}

module.exports = {
    async fetchList(query) {
        // For test purpose:
        // return JSON.parse(require('fs').readFileSync('contents.json').toString('utf-8')).map(content => extractListings(content, query)).reduce((ret, cur) => [...ret, ...cur])

        const timeout = parseInt(process.env['TIMEOUT'], 10) || 30000
        const page = await openAndWait(query)
        const goNextPage = async () => {
            const btn = await page.$('.paginator__pages ~ .button:not([disabled])')
            if (btn) {
                await btn.click()
                await page.waitForNavigation({ timeout, waitUntil: 'networkidle0' }).then(nop, nop)
                return true
            } else {
                return false
            }
        }
        const numOfPages = async () => {
            const btns = await page.$$('.paginator__page-button')
            return btns.length || 1
        }

        console.error(`announced pages = ${ await numOfPages() }`)
        let pages = 0
        let contents = []
        do {
            contents.push(await page.content())
            console.error(`  captured ${++pages} page`)
        } while(pages < await numOfPages() && await goNextPage())
        await page.destroy()

        require('fs').writeFileSync('contents.json', JSON.stringify(contents, null, '  '))

        return contents.map(content => extractListings(content, query)).reduce((ret, cur) => [...ret, ...cur])
    },
    async fetchProperty(property) {

    }
}
