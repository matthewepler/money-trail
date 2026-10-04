import type { CategoryRule } from './categorizer.js';

// Order is priority: the first matching rule wins. Specific rules sit above general ones
// (UBER EATS before UBER; fees and transfers before merchants). Plain data — edit freely.
// Patterns use \b so "rent" doesn't match "current". Merchant rules carry no direction, so a
// refund lands in the same category and nets out. Fee, transfer, income, and loan rules are
// directional: a keyword buried in a long memo must not turn an inbound wire into a "fee".
export const DEFAULT_CATEGORY_RULES: readonly CategoryRule[] = [
  {
    category: 'BANK_FEES',
    direction: 'out',
    patterns: [/\bfees?\b/i, /\boverdraft\b/i, /\binsufficient funds\b/i, /\breturned item\b/i],
  },
  {
    category: 'INCOME',
    direction: 'in',
    patterns: [
      /\bpayroll\b/i,
      /\bdirect dep(osit)?\b/i,
      /\binterest (payment|paid|earned)\b/i,
      /\btax ref(und)?\b/i,
    ],
  },
  {
    category: 'TRANSFER_IN',
    direction: 'in',
    patterns: [
      /\b(online )?transfer from\b/i,
      /\bzelle payment from\b/i,
      /\bvenmo\b/i,
      /\bcash ?app\b/i,
      /\bp2p\b/i,
      /\bwire\b/i,
      /\bdeposit\b/i,
      /\b(fid bkg svc|fidelity|vanguard|schwab|robinhood|coinbase)\b/i,
      /\btransfer\b/i,
    ],
  },
  {
    category: 'TRANSFER_OUT',
    direction: 'out',
    patterns: [
      /\b(online )?transfer to\b/i,
      /\bzelle payment to\b/i,
      /\bvenmo\b/i,
      /\bcash ?app\b/i,
      /\bp2p\b/i,
      /\bwire\b/i,
      /\bwithdraw(al)?\b/i,
      /\b(fid bkg svc|fidelity|vanguard|schwab|robinhood|coinbase)\b/i,
      /\btransfer\b/i,
    ],
  },
  {
    category: 'LOAN_PAYMENTS',
    direction: 'out',
    patterns: [
      /\bloan (pmt|payment)\b/i,
      /\bmortgage\b/i,
      /\bstudent loan\b/i,
      /\bcredit (crd|card) (autopay|payment)\b/i,
      /\bamex epayment\b/i,
      /\bapple ?card\b/i,
      /\bpayment to chase card\b/i,
    ],
  },
  {
    category: 'RENT_AND_UTILITIES',
    patterns: [
      /\brent\b/i,
      /\bcon ?ed(ison)?\b/i,
      /\bnational grid\b/i,
      /\belectric\b/i,
      /\butilit(y|ies)\b/i,
      /\b(verizon|at&t|t-mobile|comcast|xfinity|spectrum)\b/i,
    ],
  },
  {
    category: 'FOOD_AND_DRINK',
    patterns: [
      /\buber ?eats\b/i,
      /\b(doordash|grubhub|seamless)\b/i,
      /\btst\*/i,
      /\b(starbucks|dunkin|mcdonald'?s|chipotle|subway|domino'?s)\b/i,
      /\b(whole foods|trader joe'?s|safeway|kroger|aldi|shoprite|stop & shop|wegmans|publix)\b/i,
      /\b(cafe|coffee|bakery|bagel|deli|restaurant|diner|grill|sushi|pizza|taqueria)\b/i,
    ],
  },
  {
    category: 'TRANSPORTATION',
    patterns: [
      /\b(uber|lyft)\b/i,
      /\b(mta|metrocard|omny|nj transit)\b/i,
      /\b(shell|exxon|mobil|chevron|sunoco|bp)\b/i,
      /\b(parking|toll|ez ?pass)\b/i,
    ],
  },
  {
    category: 'TRAVEL',
    patterns: [
      /\bairlines?\b/i,
      /\b(jetblue|amtrak|airbnb|expedia)\b/i,
      /\b(marriott|hilton|hyatt|hotel)\b/i,
    ],
  },
  {
    category: 'ENTERTAINMENT',
    patterns: [
      /\b(netflix|hulu|spotify|youtube ?(premium|tv)|hbo|peacock|paramount)\b/i,
      /\b(amc|regal|cinema|theater|theatre|ticketmaster|stubhub)\b/i,
    ],
  },
  {
    category: 'GENERAL_MERCHANDISE',
    patterns: [
      /\b(amazon|amzn|target|walmart|best buy|costco|ikea|etsy|ebay|dollar (general|tree))\b/i,
    ],
  },
  {
    category: 'HOME_IMPROVEMENT',
    patterns: [/\b(home depot|lowe'?s|ace hardware|hardware)\b/i],
  },
  {
    category: 'MEDICAL',
    patterns: [
      /\b(pharmacy|cvs|walgreens|rite aid)\b/i,
      /\b(dental|dentist|doctor|medical|clinic|hospital|urgent care)\b/i,
    ],
  },
  {
    category: 'PERSONAL_CARE',
    patterns: [/\b(barber|salon|spa|nails|gym|fitness|yoga|massage)\b/i],
  },
  {
    category: 'GOVERNMENT_AND_NON_PROFIT',
    patterns: [/\b(dmv|irs|donation|charity|unicef|red cross)\b/i, /\b(city|county|state) of\b/i],
  },
  {
    category: 'GENERAL_SERVICES',
    patterns: [
      /\binsurance\b/i,
      /\b(usps|fedex|ups store|postage)\b/i,
      /\b(laundromat|laundry|dry clean(er|ing)?|storage)\b/i,
      /\b(tuition|university|college)\b/i,
    ],
  },
];
