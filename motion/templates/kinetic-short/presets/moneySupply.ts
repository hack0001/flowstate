// Short: "Inflation used to mean more money" — content for the KineticShort template.
// Quotes checked: Federal Reserve Bulletin (1919), as quoted in Bryan, "On the Origin and Evolution of the Word Inflation",
// Federal Reserve Bank of Cleveland Economic Commentary (15 Oct 1997); Merriam-Webster "inflation" sense 2 (checked 13 Nov 2026).
import {ShortContent} from '../KineticShort';
import {IconName} from '../../../system/icons';

export const MONEY_SUPPLY: ShortContent = {
  s1: {wordmark: 'INFLATION', tiles: ['M1', 'M2', 'Cr', 'Ln', 'Bd', 'Dp', 'Rs'], from: 100, to: 50, suffix: '/35Y', stamp: 'HALVED'},
  s2: {icon: 'BookOpen' as IconName, name: 'INFLATION', pill: 'WHAT IT USED TO MEAN', big: ['MORE', 'MONEY']},
  s3: {name: 'Sound Money', handle: '@soundmoney', lines: ['ask anyone what inflation is and they\'ll say prices going up.', 'that\'s the symptom, not the cause.'],
    body: 'the word started out meaning something else entirely: more money.', media: {label: 'B-ROLL SLOT · supermarket prices', video: true}},
  s4: {title: 'BLAME', words: ['GREED', 'SUPPLY', 'ENERGY'], media: [{label: 'B-ROLL SLOT · corporate greed'}, {label: 'B-ROLL SLOT · supply chains'}, {label: 'B-ROLL SLOT · energy bills'}], credit: 'A NEW VILLAIN EVERY YEAR'},
  s5: {name: 'Sound Money', handle: '@soundmoney', text: ['every year we get a new villain.', 'but everything keeps getting dearer together.'], hlWords: 'everything', card: {label: 'IMAGE SLOT · prices chart'}, banner: 'ALL AT ONCE?'},
  s6: {lines: ['SO WHAT', 'IS', 'INFLATION?']},
  s7: {lines: ['ASK THE', 'FED (1919)'], media: {label: 'IMAGE SLOT · old bulletin / Fed building'}},
  s8: {kicker: 'FEDERAL RESERVE BULLETIN · 1919', title: 'Inflation, defined', sub: 'As quoted by the Federal Reserve Bank of Cleveland, 1997',
    body: ['“Inflation is the process of', '', 'making addition to currencies', ' not based on a commensurate increase in the production of goods.”'], footer: 'SOURCE · CLEVELAND FED ECONOMIC COMMENTARY',
    mono: ['• About:    currency (money)', '• Trigger:  more money, same goods', '• Prices:   not mentioned', '• Source:   Fed Bulletin, 1919'], monoHl: [1, 2], banner: 'CAUSE, NOT SYMPTOM'},
  s9: {pill: 'DOUBLE THE MONEY, SAME GOODS', a: 10, b: 20, unit: 'SAME BASKET', media: [{label: 'IMAGE SLOT · money printer'}, {label: 'IMAGE SLOT · shopping basket'}]},
  s10: {pill: 'WHAT WE SEE', word: 'SYMPTOM'},
  s11: {pill: 'TODAY\'S DICTIONARY', head: 'Merriam-Webster, "inflation" (sense 2):',
    lines: ['a continuing rise in', 'the general price level', 'usually attributed to', 'an increase in the volume', 'of money and credit', 'relative to available', 'goods and services'],
    foot: ['Prices come first. The cause comes second.', 'Source: merriam-webster.com'], hl: [0, 1, 3, 4]},
  s12: {items: ['RENT', 'FOOD', 'ENERGY', 'CARS', 'HOUSES', 'STOCKS', 'GOLD'], pill: 'NEW MONEY CHASES ALL OF IT'},
  s13: {title: 'The word itself', sub: 'You inflate a balloon. It expands, then shrinks.', body: ['Prices don\'t inflate.', ' They rise. ', 'Money and credit ', 'inflate', '.'], footer: 'INFLATE · EXPAND · CONTRACT'},
  s14: {icon: 'BookOpen' as IconName, number: '1919', label: 'WHEN IT MEANT MONEY', media: {label: 'IMAGE SLOT · 1919 bulletin scan'}},
  s15: {a: 'MONEY', b: 'PRICES', bIcon: 'TrendingUp' as IconName},
  s16: {top: 'SOUND MONEY', lines: [['WATCH THE', 'w'], ['MONEY', 'r'], ['SUPPLY.', 'w']], sizes: [140, 230, 200]},
};

export const MS_SEGMENT_NAMES = ['Hook', 'Meaning', 'Symptom', 'Villains', 'AllAtOnce', 'WhatIsIt', 'AskTheFed', 'Fed1919', 'DoubleMoney', 'Symptom2', 'Dictionary', 'ChasesEverything', 'TheWord', 'Year1919', 'MoneyVsPrices', 'Closer'];
