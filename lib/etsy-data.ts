export type EtsyNote = {
  name: string
  priority: 'High' | 'Medium' | 'Low'
  notes: string
  file_url: string
  notion_url: string
}

export type SoftwareTool = {
  name: string
  status: 'Active' | 'Not Active' | ''
  priority: 'High' | 'Low'
  notes: string
  file_url: string
  notion_url: string
}

export type EtsyTodo = {
  name: string
  stage: 'Not Started' | 'Started' | 'Ongoing' | 'Completed'
  priority: 'High' | 'Medium' | 'Low'
  notes: string
  target_date: string
  notion_url: string
}

export type EtsyLink = {
  name: string
  url: string
  created: string
  notion_url: string
}

export type BatchItem = {
  id: number
  idea_theme: string
  niche: string
  batch_priority: 'High' | 'Medium' | 'Low'
  batch_stage: string
  method: string
  seed_keyword: string
  notion_url: string
}

// -- Etsy Notes ----------------------------------------------------------------
export const ETSY_NOTES: EtsyNote[] = [
  { name:'The ULTIMATE Print-on-Demand Design Tutorial - Alek', priority:'High', notes:'', file_url:'https://docs.google.com/document/d/16elxBStAPGz-6gLf3So0PU62BqD0rfwE2_dx7jEnJas/edit', notion_url:'https://app.notion.com/p/183ed686b47d808e9444cc4944ee3f61' },
  { name:'Etsy Plan of Action', priority:'High', notes:'', file_url:'https://docs.google.com/document/d/10pfF0LKnixnlIEtTrHp-QLYR2kx6Kh2Vrn8fTvCkbQ0/edit', notion_url:'https://app.notion.com/p/183ed686b47d80f3ab0cf891ed7751b8' },
  { name:'If I started EtsyToday - YouTube Video', priority:'High', notes:'C U Online', file_url:'https://docs.google.com/document/d/1h4ja9IDZ1Gc8jDqRa1-8TTeU_JC-HEc3sQav-9g_jaM/edit', notion_url:'https://app.notion.com/p/183ed686b47d80b2bbecdbf02f9f70a2' },
  { name:'Alek Vid - Scale Shop quickly', priority:'High', notes:'', file_url:'https://docs.google.com/document/d/1FcHMaig-3x7ruwKfc3Gt53Nml-SNuItnhrRYHtUa0pQ/edit', notion_url:'https://app.notion.com/p/183ed686b47d8057a601de99c9c11c7c' },
  { name:'Research Etsy Notes - Andreas', priority:'High', notes:'', file_url:'https://docs.google.com/document/d/1O_CnFB-o8pMJgbJ0wnTrKpyE3F6bzhRBVMR4jrMVLOs/edit', notion_url:'https://app.notion.com/p/183ed686b47d8097abedfc43c8a19e3f' },
  { name:'Etsy - Andreas Notes', priority:'High', notes:'', file_url:'https://docs.google.com/document/d/1j6Qu3ZFCFmmIo7IRrbrd_SlnPHJD9RD_4pRQSkxdOBk/edit', notion_url:'https://app.notion.com/p/183ed686b47d801481fbeed4480603bb' },
  { name:'Alek Course Etsy Notes', priority:'High', notes:'', file_url:'https://docs.google.com/document/d/16gh1foAkR_2ccw6skjJybyB9T5SxC64OB3pztnu-hLc/edit', notion_url:'https://app.notion.com/p/183ed686b47d809a8194cbd93cf62dde' },
  { name:'Publishing Checklist', priority:'High', notes:'Screenshot', file_url:'', notion_url:'https://app.notion.com/p/183ed686b47d807c935dd996e5c44f02' },
  { name:'Typical Figma Ideas Board', priority:'High', notes:'Screenshot', file_url:'', notion_url:'https://app.notion.com/p/183ed686b47d80a89b19da27422bd90f' },
  { name:'Andreas - 5 Easy Design Tips to Create Shirts That Sell', priority:'Medium', notes:'', file_url:'https://docs.google.com/document/d/1EWZDM6pRWArd36RT6myZPi_LtPtquY_h8iqPrTB0HSs/edit', notion_url:'https://app.notion.com/p/183ed686b47d8019bc59e0a2fedbbd07' },
  { name:'Santrel Best Way To Start Print On Demand (Complete Tutorial)', priority:'Medium', notes:'', file_url:'https://docs.google.com/document/d/1ehioxyvS-P3lytPXJEGs7fi3K5rsv1PxoCq1DZGmSzE/edit', notion_url:'https://app.notion.com/p/183ed686b47d80ae9505dd7bfe330d7d' },
  { name:'Alek Notes Making Designs', priority:'Low', notes:'Put in workflow', file_url:'https://docs.google.com/document/d/1l-D1np5jJQP7Qki8LAiUueqD6EnkjA7WjMSSn9vqSmE/edit', notion_url:'https://app.notion.com/p/182ed686b47d80628069e892e7d93ea8' },
  { name:'Alek Course Policies', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/18HzWYl3mq_OFrQoEVx3Q5MmpRBc0J5WrC9nqliU5O_4/edit', notion_url:'https://app.notion.com/p/183ed686b47d807e8c89d2b4c471d53e' },
  { name:'The Canva Ai Side Hustle Earning $1,180+/Day - Wholesale Ted', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/17GUUBE1e9AGV7dQU4NFkU8N3F0cBkatqMFrC8Y6dCX8/edit', notion_url:'https://app.notion.com/p/183ed686b47d8091b1cdcdf495069b9e' },
  { name:'Easiest Way to Start Print on Demand in 2025 - Alek', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1gXVDaE_VscwMN7JVyA2WufhrtQiVz01Q5mpNWjIfLdc/edit', notion_url:'https://app.notion.com/p/183ed686b47d808db1d9d9614884e580' },
  { name:'My Top 4 Game-Changing Print on Demand Tools - CU Online', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1SmxTExg3hrY3Mc1G7vy3No8OCdT6a_7U8aROITuuvh4/edit', notion_url:'https://app.notion.com/p/183ed686b47d8064ac52e5c5f85a2fa3' },
  { name:'TopNotchThreadz Listing Spreadsheet', priority:'Low', notes:'', file_url:'https://docs.google.com/spreadsheets/d/12so2LNiE8FAIFCRv6u2PEiqOJth62vsO7KsHF2IJQWM/edit', notion_url:'https://app.notion.com/p/183ed686b47d80c5badbc2b4395860c8' },
  { name:'Etsy notes Cassiy Johnson', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/12x9_aNJV-703JaEQJyQXcOZahhFCUMdBlI5jQR3-slY/edit', notion_url:'https://app.notion.com/p/183ed686b47d80bbb342c6417d5b342e' },
  { name:'Pod Insights - Chris Heckman', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1Q9sHRqzT3eX6XNxxrQkx3ByPSIuploVdEkZL-645YXM/edit', notion_url:'https://app.notion.com/p/183ed686b47d80e190c3fd5cd24d1fdb' },
  { name:'Etsy Starting Plan', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1T0SR-qo_OMcDjdJjP8NMAXB6hTkeceTTljAjUdupNZI/edit', notion_url:'https://app.notion.com/p/183ed686b47d806ba8caff89ce20963f' },
  { name:'How Top Etsy Sellers Create 100+ Designs in 1 Hour - Cassi Johnson', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1MsuK_zwM1ki57O0KXnFfNqV8A0lfQh64yKp-5MjtJN4/edit', notion_url:'https://app.notion.com/p/183ed686b47d80e7b0b7cf07a0856ca2' },
  { name:'Cassiy Notes on Top New Etsy Stores', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1rcvBo7IGntM5-SC4ra-4RNzZPE2nDNSB-RAI8r0rE6Y/edit', notion_url:'https://app.notion.com/p/183ed686b47d80bd9165e0fede1bec8c' },
  { name:'Wholesale Ted 15 Genius Printify Hacks In Under 10 Minutes', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1GflfcppWLD_263yX5u-WrnCQ0dNloQMWo5cos9i_47Q/edit', notion_url:'https://app.notion.com/p/183ed686b47d8033b5b2cc62b31f4f9c' },
  { name:'Liam James Kay - Etsy', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1SxFQVUp4mqiOe4kQY12KQhUxDd1zZRyjwtWg7NLIkzk/edit', notion_url:'https://app.notion.com/p/183ed686b47d8002b4fed5ec0c94c23d' },
  { name:'9 Tips BEFORE You Start Print on Demand - $1,000,000+ Thoughts', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1nPGx3eUD1WK6pNGOFkDemAGG3oo3iNxYtmxtV_cCNYg/edit', notion_url:'https://app.notion.com/p/183ed686b47d80dbbf03dfdb792ea8bb' },
  { name:'Wholesale Ted - How I Get Free Traffic On Etsy', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1G1iVXqBdocu9hjugoWttO2Xn2OFtj5MHdmS4Lf-IdFc/edit', notion_url:'https://app.notion.com/p/183ed686b47d800f945bd2a20d30f3f7' },
  { name:'Alek - Easiest Way To Start Print-on-Demand in 2024 (From Scratch)', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1eScIL-f-Umn1UH3BEi1VyiPCkCFjcyKvkIfKyRRDtK8/edit', notion_url:'https://app.notion.com/p/183ed686b47d806a824adf1312ebf994' },
  { name:'Mark Tilbury - Passive Income: How I Started Print On Demand with $0', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1bkQ5gZYA9vnPMgMGOyEXxDkSD-6Oa3MrYdgaGIeVzDg/edit', notion_url:'https://app.notion.com/p/183ed686b47d804ba192d722988e0079' },
  { name:'I Made $509/Day With Basic Affiliate Marketing Videos', priority:'Low', notes:'', file_url:'https://docs.google.com/document/d/1hsQYcRObpsYoyoxotRuRKH1cSxqoJBZR2-cRB7e3k0I/edit', notion_url:'https://app.notion.com/p/183ed686b47d80e7afdcd4333ff5679d' },
  { name:'POD Products That Make Me 400k/Year on Etsy', priority:'Low', notes:'Put on sweatshirts Gildan 18000 and Comfort Colours 1717', file_url:'https://docs.google.com/document/d/1_Fsst8wnsNascXV7bCu0Lif7yRN4HJLObzLoPTE_2cQ/edit', notion_url:'https://app.notion.com/p/195ed686b47d80d18faed28806ba2ddc' },
]

// -- Software Pipeline ---------------------------------------------------------
export const SOFTWARE_PIPELINE: SoftwareTool[] = [
  { name:'Simply Listed', status:'Active', priority:'Low', notes:'', file_url:'', notion_url:'https://app.notion.com/p/181ed686b47d80f8af2cd96d5b4fbbb0' },
  { name:'Alura', status:'Active', priority:'Low', notes:'Research Tool', file_url:'https://www.alura.io/', notion_url:'https://app.notion.com/p/181ed686b47d803aaef9d40112fe2d66' },
  { name:'Midjourney', status:'Active', priority:'Low', notes:'Creating images. Use in Discord + browser.', file_url:'https://alpha.midjourney.com/explore?tab=top', notion_url:'https://app.notion.com/p/181ed686b47d800fb8dfc43ff94462a8' },
  { name:'Discord', status:'Active', priority:'Low', notes:'For Midjourney', file_url:'', notion_url:'https://app.notion.com/p/181ed686b47d803aa0b3f8caf3cfe5b3' },
  { name:'Midjourney Browser Prompts', status:'Active', priority:'Low', notes:'', file_url:'https://alpha.midjourney.com/', notion_url:'https://app.notion.com/p/181ed686b47d81f2a97cfc334de2476a' },
  { name:'Creative Fabrica', status:'Active', priority:'Low', notes:'', file_url:'https://www.creativefabrica.com', notion_url:'https://app.notion.com/p/181ed686b47d8106b810fd3efd28e6ff' },
  { name:'ChatGPT', status:'Active', priority:'Low', notes:'', file_url:'https://chatgpt.com', notion_url:'https://app.notion.com/p/181ed686b47d8142a283e115a6d4d0ce' },
  { name:'Printify', status:'Active', priority:'Low', notes:'', file_url:'https://printify.com/app/auth/login', notion_url:'https://app.notion.com/p/181ed686b47d8197b453c971049074ab' },
  { name:'Alek Sheffield Etsy Course', status:'Active', priority:'Low', notes:'', file_url:'https://www.sixfigurestorefront.com/login', notion_url:'https://app.notion.com/p/181ed686b47d818db181da1fa1f1e872' },
  { name:'Listings (Google Drive)', status:'Active', priority:'Low', notes:'', file_url:'https://drive.google.com/drive/u/3/folders/1IvkX5B6v7JlY9Mj0dfvr2HMD62S757vC', notion_url:'https://app.notion.com/p/181ed686b47d814ca898e3e14544bab8' },
  { name:'Adobe Illustrator', status:'Active', priority:'Low', notes:'', file_url:'', notion_url:'https://app.notion.com/p/181ed686b47d81598b84cffdaf335d70' },
  { name:'Designs (Canva / Figma / Kittl)', status:'Active', priority:'Low', notes:'Canva, Figma, Kittl', file_url:'https://www.canva.com/', notion_url:'https://app.notion.com/p/181ed686b47d817287e5c441f663a993' },
  { name:'Trademark Checker', status:'Active', priority:'Low', notes:'USPTO + Flying Research', file_url:'https://tmsearch.uspto.gov/search/search-information', notion_url:'https://app.notion.com/p/181ed686b47d81bc8040fe55633432ac' },
  { name:'Everbee', status:'Not Active', priority:'Low', notes:'Research Tool', file_url:'https://everbee.io/', notion_url:'https://app.notion.com/p/181ed686b47d8014a320e01612d01786' },
  { name:'Prelist', status:'Not Active', priority:'High', notes:'Alek Etsy Uploader. Need to do free trial. Buy lifetime.', file_url:'https://www.prelist.io/#feature', notion_url:'https://app.notion.com/p/181ed686b47d80e78351d12916f7db78' },
  { name:'Listing View', status:'Not Active', priority:'Low', notes:'Alek Keyword Research. Do free trial.', file_url:'', notion_url:'https://app.notion.com/p/181ed686b47d80e39d1ffc1e773e8dd2' },
  { name:'Recraft.ai', status:'Not Active', priority:'Low', notes:'Image generator, Vectorizer, Photo editor, Mockup Generator, Image Upscaler, BG remover', file_url:'https://www.recraft.ai/', notion_url:'https://app.notion.com/p/181ed686b47d805d8474e3e9ee67e1c4' },
  { name:'Printify API Reference', status:'Not Active', priority:'Low', notes:'Build own uploader', file_url:'https://developers.printify.com/#overview', notion_url:'https://app.notion.com/p/181ed686b47d80ebac22d3a202017c9e' },
  { name:'Hello Custom', status:'Not Active', priority:'Low', notes:'Custom orders', file_url:'https://hellocustom.io/', notion_url:'https://app.notion.com/p/181ed686b47d818a87e8ea6b2b297132' },
  { name:'Quickbooks', status:'', priority:'Low', notes:'', file_url:'', notion_url:'https://app.notion.com/p/181ed686b47d808aa9eeeb4943bb68cd' },
  { name:'Slack', status:'', priority:'Low', notes:'', file_url:'', notion_url:'https://app.notion.com/p/181ed686b47d8092b08ff5edb01b2ebe' },
  { name:'Trello', status:'', priority:'Low', notes:'', file_url:'', notion_url:'https://app.notion.com/p/181ed686b47d802b9131fff460793ab5' },
  { name:'Font Matcherator', status:'', priority:'Low', notes:'', file_url:'https://www.fontspring.com/matcherator', notion_url:'https://app.notion.com/p/181ed686b47d809d9d06d9229fb6abc2' },
  { name:'Flying Research Legal Check', status:'', priority:'Low', notes:'', file_url:'https://app.flyingresearch.net/', notion_url:'https://app.notion.com/p/181ed686b47d80ada207c08646a8069c' },
]

// -- Etsy Todos ----------------------------------------------------------------
export const ETSY_TODOS: EtsyTodo[] = [
  { name:'Thank You cards for purchases on store', stage:'Completed', priority:'High', notes:'Put Etsy shop link in them. Also put discount code to encourage repeat purchases.', target_date:'', notion_url:'https://app.notion.com/p/17fed686b47d80b1a6f9d9399d965083' },
  { name:'Wholesale Ted YouTube Vids - 400 listings => 7k per week', stage:'Completed', priority:'High', notes:'WholeSale Ted', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d80c7a344fbe58f998170' },
  { name:'Add social proof to etsy', stage:'Not Started', priority:'High', notes:'Check ChatGPT for ways how to with non sales', target_date:'2026-01-23', notion_url:'https://app.notion.com/p/1aced686b47d8008a4c0f314a6120cc0' },
  { name:'IMPORTANT - Setup Matching Shirts', stage:'Started', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/228ed686b47d8060825de9de97a6aeb5' },
  { name:'Do Simply Listed of Comfort Colours Light and Dark mockups', stage:'Not Started', priority:'High', notes:'', target_date:'2026-02-06', notion_url:'https://app.notion.com/p/228ed686b47d80a997ddf16343883fdb' },
  { name:'Look at iPhoto from 18th Nov 2024 - ideas', stage:'Started', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/181ed686b47d805582a4ecd9d29feefc' },
  { name:'Text Mrk to get going on testing software', stage:'Completed', priority:'High', notes:'', target_date:'2026-03-07', notion_url:'https://app.notion.com/p/181ed686b47d80ffa5a2f75662f12289' },
  { name:'Add guarantee', stage:'Completed', priority:'High', notes:'', target_date:'2025-08-15', notion_url:'https://app.notion.com/p/181ed686b47d80c5b635e8bffc17c8cb' },
  { name:'Buy eRank and Everbee for Research', stage:'Completed', priority:'High', notes:'', target_date:'', notion_url:'https://app.notion.com/p/1a7ed686b47d8075a9bdf563ef3a0c79' },
  { name:'Add 10 Best Selling Designs in Master Template', stage:'Completed', priority:'High', notes:'', target_date:'', notion_url:'https://app.notion.com/p/228ed686b47d80dd8bacd30f701f58e4' },
  { name:'Check off Non performing ads', stage:'Completed', priority:'High', notes:'', target_date:'2026-01-11', notion_url:'https://app.notion.com/p/228ed686b47d80e68f33d83f51bc3583' },
  { name:'10 Best Selling Designs in Master Template', stage:'Completed', priority:'High', notes:'', target_date:'2025-12-14', notion_url:'https://app.notion.com/p/228ed686b47d800ba37ef82055aedd42' },
  { name:'Go through CU Online Checklist', stage:'Completed', priority:'High', notes:'Good resource', target_date:'2025-12-13', notion_url:'https://app.notion.com/p/228ed686b47d801f8459e21c73c207d7' },
  { name:'Do Simply Areas + 2x Templates + 2x necklace on iMAC', stage:'Completed', priority:'High', notes:'', target_date:'2025-12-13', notion_url:'https://app.notion.com/p/228ed686b47d8067bb6cef9046793f0b' },
  { name:'Put love it guarantee in mockups along the bottom', stage:'Completed', priority:'High', notes:'Mockup centred', target_date:'2026-02-06', notion_url:'https://app.notion.com/p/228ed686b47d8055b71de880adb1f24e' },
  { name:'Personalised description and prices - go through top custom listings', stage:'Completed', priority:'High', notes:'', target_date:'2025-12-14', notion_url:'https://app.notion.com/p/228ed686b47d80dbb194e69271fca88d' },
  { name:'Wholesale Ted Videos', stage:'Completed', priority:'High', notes:'', target_date:'2025-07-07', notion_url:'https://app.notion.com/p/228ed686b47d80ef8289d12251b6a3b9' },
  { name:'Keywords first then designs then white designs', stage:'Completed', priority:'High', notes:'', target_date:'2025-12-14', notion_url:'https://app.notion.com/p/228ed686b47d80c087d1ec21938f64f1' },
  { name:'Cancel Playground Sub', stage:'Completed', priority:'High', notes:'', target_date:'2025-12-14', notion_url:'https://app.notion.com/p/228ed686b47d800aa142d1a4ad7b68f7' },
  { name:'Start using Sweatshirts Gildan 18000', stage:'Completed', priority:'High', notes:'', target_date:'2025-12-13', notion_url:'https://app.notion.com/p/228ed686b47d800b949cf28601ca7a56' },
  { name:'Checklist of Things to do at each stage', stage:'Not Started', priority:'High', notes:'', target_date:'2026-01-10', notion_url:'https://app.notion.com/p/228ed686b47d802789c6d5a50621e916' },
  { name:'Vela Profile update', stage:'Completed', priority:'High', notes:'', target_date:'2025-08-08', notion_url:'https://app.notion.com/p/229ed686b47d80aea54ad2e26192c4ac' },
  { name:'Refresh Listings every week', stage:'Completed', priority:'High', notes:'', target_date:'2025-12-14', notion_url:'https://app.notion.com/p/229ed686b47d80748f1df5f75eb23e74' },
  { name:'200 Listings - Start Doing Fall + Halloween Season Listings', stage:'Completed', priority:'High', notes:'', target_date:'2025-12-13', notion_url:'https://app.notion.com/p/229ed686b47d8066bdc3eedaf1075a5e' },
  { name:'First thing in morning: Browse Etsy + Check Ads + Add Ten Listings to Master Template', stage:'Completed', priority:'High', notes:'Copy 1 successful listing exactly. Put listings in a spreadsheet. Double down on what is working. Build templates, ensure shipping < $6.', target_date:'2026-01-11', notion_url:'https://app.notion.com/p/22ced686b47d800f859af93b490ac46b' },
  { name:'Post Purchase Messages', stage:'Not Started', priority:'High', notes:'', target_date:'2026-01-16', notion_url:'https://app.notion.com/p/2dced686b47d8074bae5ffadcfb563af' },
  { name:'Buy and use Monday.com and Slack', stage:'Ongoing', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/2dced686b47d80ea81ecc484ff3e6e09' },
  { name:'AI Vids Midjourney mockup', stage:'Ongoing', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/2dced686b47d8080bcbdfda50652ec8b' },
  { name:'Ask for review and follow up on store', stage:'Ongoing', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/2dced686b47d80e598c3eb0f7d4a7953' },
  { name:'Reprice Good Performers', stage:'Ongoing', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/2dced686b47d80b3b755ff4b59ee862c' },
  { name:'Renew Expired Listings', stage:'Ongoing', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/2dced686b47d8095b5a3fa0cc22aa8e3' },
  { name:'Do Winter Flat Lay Mockups in Simply Listed', stage:'Started', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/2dced686b47d8090acecf8804709ef64' },
  { name:'Add Screenshots to workflow', stage:'Completed', priority:'High', notes:'Screenshots that printed out in laptop bag', target_date:'2026-01-05', notion_url:'https://app.notion.com/p/2dced686b47d801399cbddf5994cc681' },
  { name:'Add shipping profile and template to notion template section', stage:'Completed', priority:'High', notes:'Printify card and production settings', target_date:'2026-01-05', notion_url:'https://app.notion.com/p/2dced686b47d807f9ed7d3b48dd06e94' },
  { name:'Update all Cover Photos - improve look at others', stage:'Ongoing', priority:'High', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/2dced686b47d804b9f4ed4df71bd5850' },
  { name:'Write down process from start to finish', stage:'Ongoing', priority:'Medium', notes:'Break it down to granular level. Use discord for images. AIM: take elements from popular product in a niche and replicate in another niche.', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/181ed686b47d809fa18ae09fae14da59' },
  { name:'Etsy audit - monthly', stage:'Ongoing', priority:'Medium', notes:'Check monthly views, best listings, most successful. What is working.', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/183ed686b47d80578f4cde43b4376554' },
  { name:'Notion automation with gmail and notion calendar', stage:'Started', priority:'Medium', notes:'Start make automation', target_date:'', notion_url:'https://app.notion.com/p/19ded686b47d80688ab4c8f4a4544bd0' },
  { name:'Buy Profit tree for Etsy', stage:'Not Started', priority:'Medium', notes:'', target_date:'2026-01-11', notion_url:'https://app.notion.com/p/228ed686b47d80bfbaebcf1abdc87019' },
  { name:'Start Using Swift POD Printers', stage:'Not Started', priority:'Medium', notes:'', target_date:'2026-01-04', notion_url:'https://app.notion.com/p/228ed686b47d802dbd13e22671693f5e' },
  { name:'Start using Gigapixel for upscaling in ChatGPT', stage:'Started', priority:'Medium', notes:'', target_date:'2026-05-14', notion_url:'https://app.notion.com/p/228ed686b47d80449f36f0d2f0fec9eb' },
  { name:'Look at Amazon Cards for funny inspiration - gap in the market', stage:'Started', priority:'Medium', notes:'', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d806abae1f33133b3d617' },
  { name:'Use midjourney browser for images', stage:'Completed', priority:'Medium', notes:'', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d805aa770c2c787a0ec37' },
  { name:'SETUP VA', stage:'Ongoing', priority:'Medium', notes:'Watch CU Online. onlinejobs.ph. Upwork. Go through process.', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d806485a7f511ba56d997' },
  { name:'Make sure sales on at 50% every 48 hours', stage:'Completed', priority:'Medium', notes:'', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d80a893ccf6b80a2f1274' },
  { name:'Python Script to access Etsy API', stage:'Started', priority:'Low', notes:'https://developers.etsy.com/documentation/tutorials/quickstart/', target_date:'2026-07-18', notion_url:'https://app.notion.com/p/228ed686b47d800fbc13eb6fef769e55' },
  { name:'Buy 1Password + Start integrating and using', stage:'Started', priority:'Low', notes:'', target_date:'2026-05-10', notion_url:'https://app.notion.com/p/228ed686b47d80f68b0fd39f8f98bc5a' },
  { name:'Add Make to workflow and Etsy + Monday and Slack', stage:'Ongoing', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/2d8ed686b47d8075a7e6e60fc12b28d8' },
  { name:'Manually renew listings from last year - might have expired', stage:'Ongoing', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/2d8ed686b47d806aadc4ffe72338c8d8' },
  { name:'Figure out 1Password', stage:'Not Started', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d80198d97e7c5b7c4b121' },
  { name:'Organise paper notes', stage:'Completed', priority:'Low', notes:'Put all docs into table', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d80c8be30e5c09e50d1ae' },
  { name:'Setup TopNotch Mugz after 10k - took Alek 3 months', stage:'Not Started', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d80f0bdbfcd60102ab6cf' },
  { name:'Alura + vid mockups sort out', stage:'Not Started', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d809e9ac4e2024d12f128' },
  { name:'Discord to SVG', stage:'Not Started', priority:'Low', notes:'Use Illustrator too to convert', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d80c2a794c1dee6dae349' },
  { name:'Start implementing custom orders and personalisation', stage:'Completed', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d8020a7cbffb363c1bcdd' },
  { name:'Update Shop Store', stage:'Completed', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/181ed686b47d8070b876dbbc7c992d11' },
  { name:'Start selling rugs', stage:'Not Started', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/182ed686b47d803194d9f71548792f20' },
  { name:'Make template eu2.make.com/templates', stage:'Not Started', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/2d8ed686b47d8014afa8eed11c410e23' },
  { name:'Start doing evergreen - people buy gifts at Christmas not just Christmas themed', stage:'Not Started', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/2d8ed686b47d80e2ac35e6c56179e5a3' },
  { name:'Start custom ornaments and tumblers - 200 quality designs by November', stage:'Not Started', priority:'Low', notes:'', target_date:'', notion_url:'https://app.notion.com/p/2d8ed686b47d8064b2a8f7e26be52a72' },
  { name:'Payment to Credit Card 370 on 15th', stage:'Completed', priority:'Low', notes:'', target_date:'2025-08-14', notion_url:'https://app.notion.com/p/4c45472f94524231a2a17cff7b43d63f' },
  { name:'Do email update of listing', stage:'Completed', priority:'Low', notes:'', target_date:'2025-08-08', notion_url:'https://app.notion.com/p/f33302225dfa4a3fb923214957d7b85a' },
]

// -- Etsy Links ----------------------------------------------------------------
export const ETSY_LINKS: EtsyLink[] = [
  { name:'Christian Christmas Sweatshirt - Jesus Christmas Shirt Faith Holiday', url:'https://www.etsy.com/uk/listing/4394964287/christian-christmas-sweatshirt-jesus', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d81fb941bff7da6f597ed' },
  { name:'Greatest Gift of All - Nativity Shirt, Christian Christmas Shirt', url:'https://www.etsy.com/uk/listing/1796658078/greatest-gift-of-all-nativity-shirt', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d81e9a613d5f98045924c' },
  { name:'Custom christmas jesus - Etsy UK search', url:'https://www.etsy.com/uk/search?q=custom%20christmas%20jesus', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d81858d75c7fb4ff9f34c' },
  { name:'Christmas jesus best sellers - Etsy UK', url:'https://www.etsy.com/uk/search?q=christmas%20jesus&explicit=1&is_best_seller=true', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d81ee90f5c6ad29b4e2c0' },
  { name:'SaltyGraceStudio - Etsy UK', url:'https://www.etsy.com/shop/SaltyGraceStudio', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d81039308e04f26e889cd' },
  { name:'Embroidered shirt - Etsy UK search', url:'https://www.etsy.com/uk/search?q=emroidered+shirt', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d81e5a1d3fc0e214f42fd' },
  { name:'I Require Snacks Embroidered Raccoon Tee - Comfort Colors', url:'https://www.etsy.com/uk/listing/4329344253/i-require-snacks-embroidered-raccoon-tee', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d813cbafbc0e09d3d4e80' },
  { name:'PineSpiceBooks - Everbee Shop Analyzer', url:'https://app.everbee.io/shop-analyzer/PineSpiceBooks', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d8198a34af919e77cd848' },
  { name:'Embroidered tshirt custom comfort colors - Etsy UK', url:'https://www.etsy.com/uk/search?q=embroidered%20tshirt%20custom%20comfort%20colors', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d813d93bde21ea8276fca' },
  { name:'I Hope This Email Finds You Shirt - Comfort Colors 1717', url:'https://www.etsy.com/listing/4391692420/i-hope-this-email-finds-you-shirt-funny', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d816fa19be309099364e2' },
  { name:'Custom Comfort Colors T-shirt - Personalized Embroidered Tee', url:'https://www.etsy.com/uk/listing/1905801865/custom-comfort-colors-t-shirt', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d8178b3cfe3640a6564cb' },
  { name:'Embroidered sweatshirt best sellers US - Etsy UK', url:'https://www.etsy.com/uk/search?q=embroidered%20sweatshirt&ship_to=US&explicit=1&is_best_seller=true', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d8179bb48f0dc3016e39d' },
  { name:'Embroidered Christmas Sweatshirt: Merry Christmas Bow Design', url:'https://www.etsy.com/uk/listing/4390296782/embroidered-christmas-sweatshirt-merry', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d81c289a8cbd40aef5b8f' },
  { name:'Merry christmas shirt - Etsy UK search', url:'https://www.etsy.com/uk/search?q=merry+christmas+shirt', created:'2025-12-29', notion_url:'https://app.notion.com/p/2d8ed686b47d811fad40dbf15ab647ae' },
]

// -- Batch Workflow -------------------------------------------------------------
export const BATCH_WORKFLOW: BatchItem[] = [
  { id:20, idea_theme:'Back To School', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'retro faith shirt', notion_url:'https://app.notion.com/p/226ed686b47d80de8274ec9a7bf94847' },
  { id:11, idea_theme:'Lake Life', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'Make Heaven Crowded', notion_url:'https://app.notion.com/p/225ed686b47d802a9ba0de41a31426f3' },
  { id:18, idea_theme:'Save The Bees', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'Pray over it', notion_url:'https://app.notion.com/p/226ed686b47d804e800afb21120efb12' },
  { id:27, idea_theme:'Its Still Cold', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'Personalisation', seed_keyword:'Teen Baptism gifts', notion_url:'https://app.notion.com/p/226ed686b47d80d38787fab343cfd10d' },
  { id:29, idea_theme:'Your a Hot Tea', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'Personalisation', seed_keyword:'Trust in the Lord', notion_url:'https://app.notion.com/p/226ed686b47d807e962bcc9a1da298cc' },
  { id:69, idea_theme:'Noah Shirts - Team Noah - religious', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'yeshua shirt', notion_url:'https://app.notion.com/p/238ed686b47d806e91a1f9cde09ac111' },
  { id:98, idea_theme:'Combine with Birthdays and religion', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'Add Value', seed_keyword:'50th birthday in christian shirt', notion_url:'https://app.notion.com/p/2c7ed686b47d8059bf7de0576b29561b' },
  { id:108, idea_theme:'Flower', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'Add Value', seed_keyword:'Christian Shirt Flower', notion_url:'https://app.notion.com/p/2dced686b47d801ca0fcc5175c0138e9' },
  { id:123, idea_theme:'Easter', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'He is Risen', notion_url:'https://app.notion.com/p/2e2ed686b47d800890e1f05999499f8d' },
  { id:122, idea_theme:'Embroidered Jesus Sweatshirt', niche:'', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'Embroidered Jesus Sweatshirt', notion_url:'https://app.notion.com/p/2e2ed686b47d80d59315e8c0c0708763' },
  { id:121, idea_theme:'Jesus Saves', niche:'', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'Jesus saves shirt', notion_url:'https://app.notion.com/p/2e2ed686b47d80169a8fd795f251a612' },
  { id:120, idea_theme:'Duck shirt', niche:'', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'His Way Is Better', notion_url:'https://app.notion.com/p/2e1ed686b47d804db865dd5e8543248c' },
  { id:119, idea_theme:'Winter shirt', niche:'', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'Jesus Is King', notion_url:'https://app.notion.com/p/2e1ed686b47d80cd994cf34b03223b5a' },
  { id:118, idea_theme:'America 250th Anniversary 1776', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'Made For More Tee', notion_url:'https://app.notion.com/p/2dfed686b47d80c3894efdf94940bdeb' },
  { id:115, idea_theme:'Spring Religious', niche:'', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'Love Like Jesus', notion_url:'https://app.notion.com/p/2dfed686b47d80edb4d5c84ab1b34bc8' },
  { id:112, idea_theme:'Love Like Jesus', niche:'Religious', batch_priority:'High', batch_stage:'Research + Ideas', method:'', seed_keyword:'Jesus Loves You', notion_url:'https://app.notion.com/p/2dded686b47d80ec878bd71965ad30ff' },
  { id:13, idea_theme:'QR Code', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/225ed686b47d8071bd60d7f53298e3b6' },
  { id:14, idea_theme:'Nurse Shirt', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/225ed686b47d8094890dded6e00bd280' },
  { id:15, idea_theme:'If It Was Easy Everyone Would Do It', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/225ed686b47d801d8d9ae7fdcd64e428' },
  { id:21, idea_theme:'Today Is A Good Day To', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80a5990df071480417d0' },
  { id:22, idea_theme:"I'm not responsible for my face", niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80a2a759f564f079968e' },
  { id:23, idea_theme:'Taco Dirty To Me', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d8050a386e8473e9e7ea6' },
  { id:25, idea_theme:'Etsy Search Farm', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80129d60fd379670160d' },
  { id:26, idea_theme:'Etsy Search - Its a good day', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80afab6ddc740e770ee9' },
  { id:28, idea_theme:'Move With Intention - template', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80b2a396f134d4cc6be4' },
  { id:30, idea_theme:'To My Significant Otter', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80279577c12f515c57fe' },
  { id:31, idea_theme:'Baking, Its Cheaper Than Therapy', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d8099a7b9f7c090ee26c2' },
  { id:32, idea_theme:'Cow in Cat Position Yoga', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80938bf1f4a0682d4461' },
  { id:33, idea_theme:'Cat in Cow Position Yoga', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80cebaecddb42bd09799' },
  { id:35, idea_theme:'Namas Latte', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d806b857fd0513233e37d' },
  { id:36, idea_theme:'Its a Good Day to Start - apply to lots', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80c198f4eed508934655' },
  { id:38, idea_theme:'Lettuce Bee Ideas', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d803aa120ddb81d1124d0' },
  { id:58, idea_theme:'Vintage Fruit', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'Whats Working', seed_keyword:'', notion_url:'https://app.notion.com/p/22ded686b47d80d99e14e711ad71deb1' },
  { id:53, idea_theme:'Bachelorette Designs', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/227ed686b47d804d9932d9b9cddf2f06' },
  { id:52, idea_theme:'Line drawings of flowers and animals - copy top designs', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/227ed686b47d80a4b3c4dc68471570e5' },
  { id:51, idea_theme:'Animals and Fruits in flower designs', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/227ed686b47d80ff9bcdd966e3e6db2f' },
  { id:48, idea_theme:'Floral Designs / Vintage', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'Whats Working', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d804a9dceef1c8fbf2e00' },
  { id:45, idea_theme:'T-shirts Bible verse Comfort Colors', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'Add Value', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d80b8abb6c66433e0d5c3' },
  { id:44, idea_theme:'Personalised Birthday', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d807cbbdffe334c057e74' },
  { id:43, idea_theme:'Custom Animal/Pet Designs - Cassiy Vid', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/226ed686b47d808f917efcc5479eab25' },
  { id:70, idea_theme:'Bears', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/245ed686b47d808b8870ed7ce4e3ec21' },
  { id:105, idea_theme:'Sell more flowers that have done well', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'God is Good shirt', notion_url:'https://app.notion.com/p/2dbed686b47d80159bb0d2eba703e350' },
  { id:104, idea_theme:'Flowers and animals combined', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'Couple Christian Shirt', notion_url:'https://app.notion.com/p/2dbed686b47d8087bb41cf8ad2bf79d7' },
  { id:103, idea_theme:'Floral embroidered', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'Church Merch', notion_url:'https://app.notion.com/p/2dbed686b47d80b19d56d2da320dcd3d' },
  { id:102, idea_theme:'Ill be in my office', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'Christian Shirt Fishers of Men', notion_url:'https://app.notion.com/p/2d8ed686b47d8060bd4df975780ed92c' },
  { id:101, idea_theme:'67 Trend on Bible', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'Coquette Christian', notion_url:'https://app.notion.com/p/2d8ed686b47d8011b1d1f0cb3ee01a22' },
  { id:100, idea_theme:'Reading Month March', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'Jesus Quote Shirt', notion_url:'https://app.notion.com/p/2d8ed686b47d802c8f38f7d38f12d723' },
  { id:99, idea_theme:'Idea group listings valentines mother and baby son', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'Fruit of the Spirit', notion_url:'https://app.notion.com/p/2d8ed686b47d8068b0e2fa03cd545919' },
  { id:97, idea_theme:'Winter Shirt', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'Armor of God', notion_url:'https://app.notion.com/p/289ed686b47d809c8de2dcf6fe5843f5' },
  { id:96, idea_theme:'Vintage Fruits', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/271ed686b47d80b397a2d553987f6f29' },
  { id:95, idea_theme:'Books / Bookworm', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/253ed686b47d8042a292e0a99639d323' },
  { id:93, idea_theme:'Ill be in my office x30', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/e43c0cd6c0384054b438fdcb3b0629c8' },
  { id:90, idea_theme:'Do 15 flower listings', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/5bea3ab59e404e04b47c2f9161a8db26' },
  { id:85, idea_theme:'Tis the season', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/b2a0690c1d374fc5b77ed9e54619e762' },
  { id:84, idea_theme:'Figure out 2 designs hallelujah and other - 15 listings', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/d62777eccfb44560ba7f5fdccd443a1c' },
  { id:78, idea_theme:'T-shirts Bible verse Comfort Colors (variation)', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'Changes Within Niche', seed_keyword:'', notion_url:'https://app.notion.com/p/248ed686b47d806aa003fa4e0c186d49' },
  { id:77, idea_theme:'Vintage Flowers', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/248ed686b47d80beb6a7e890c021d49a' },
  { id:76, idea_theme:'Fall', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'Add Value', seed_keyword:'', notion_url:'https://app.notion.com/p/247ed686b47d80958e86f5cc3d3495fb' },
  { id:75, idea_theme:'Halloween', niche:'Religious', batch_priority:'Low', batch_stage:'Research + Ideas', method:'', seed_keyword:'', notion_url:'https://app.notion.com/p/247ed686b47d8096bd25c789a90f4cdc' },
]
