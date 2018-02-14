const QUERY_BELCON = 'https://www.allhomes.com.au/ah/act/rent-residential/belconnen/11244512/listed-date?datetype=last_7_days'
const puppeteer = require('puppeteer')
const cheerio = require('cheerio')


// TESTING CMD:
// `NO_HEADLESS=1 node -e "require('./fetchRaw').fetchList('https://www.allhomes.com.au/ah/act/rent-residential/belconnen/11244512/listed-date?datetype=last_7_days').then(r=>console.table(r), e=>console.error(e))"`

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

function extractListings(html) {
    const $ = cheerio.load(html)
    const listings = $('#table_listings tr').map((idx, el) => {
        const $2 = (...args) => $(el).find(...args)
        const _price = $trim($2('.browse-table-price').text()).replace(/,/g, '').match(/\d+/)
        const _beds = $trim($2('.browse-listing-bed-column').text()).match(/\d+/)
        return {
            href: $2('a').attr('href'),
            thumbHref: $2('.listingThumbnailForBrowsing').attr('src'),
            summary: $trim($2('.listingRecordSummaryDetails h4').text()),
            price: _price ? Number(_price) : null,
            beds: _beds ? Number(_beds) : null,
            type: $trim($2('.browse-rental-listing-property-type-column').text()),
            agent: $trim($2('.browse-listing-agentstaff-name').text()),
            agency: $trim($2('.browse-listing-agent-name').text()),
            privateRental: $trim($2('.browse-listing-agentstaff-name').text()).includes('Private'),
            rented: $2('.badge-rented').get(0) ? true : false
        }
    }).get()
    .filter(entry => !entry.rented)
    return listings
}

module.exports = {
    async fetchList(query) {
        const page = await openAndWait(query)
        const html = await page.content()
        await page.destroy()
        return extractListings(html)
    },
    async fetchProperty(property) {

    }
}