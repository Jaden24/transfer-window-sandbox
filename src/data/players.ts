/**
 * Squad and transfer-market data.
 *
 * ⚠️ ALL FINANCIAL FIGURES ARE ILLUSTRATIVE.
 *
 * Club and player names are real because the point of this sandbox is that you
 * recognise the constraints. The fees, wages, contract lengths, revenues and
 * prior-season losses are invented approximations chosen to make the *rules*
 * legible. They are not club accounts, they are not reported figures, and they
 * should not be cited as either. The rules themselves (PSR, amortisation,
 * squad registration) are real and public — that is the part worth learning.
 *
 * Tuple layout keeps ~100 players readable:
 * [id, name, position, age, homegrown, clubTrained, feeM, contractLen, yearsElapsed, wageK, valueM]
 */

import type { Player, Position } from '../engine/types';

type Row = [
  string, string, Position, number, boolean, boolean,
  number, number, number, number, number,
];

const M = 1_000_000;
const K = 1_000;

function expand(clubId: string | null, rows: Row[]): Player[] {
  return rows.map(
    ([id, name, position, age, homegrown, clubTrained, feeM, len, elapsed, wageK, valM]) => ({
      id,
      name,
      position,
      age,
      clubId,
      homegrown,
      clubTrained,
      signedFee: feeM * M,
      contractLengthAtSigning: len,
      yearsElapsed: elapsed,
      weeklyWage: wageK * K,
      marketValue: valM * M,
    }),
  );
}

// --- Aston Villa -----------------------------------------------------------
const VILLA: Row[] = [
  ['av-martinez',   'Emiliano Martínez',   'GK', 33, false, false, 20, 5, 4, 120, 22],
  ['av-olsen',      'Robin Olsen',         'GK', 36, false, false,  3, 3, 2,  35,  2],
  ['av-proctor',    'Oliwier Zych',        'GK', 21, true,  true,   0, 4, 1,  12,  4],
  ['av-konsa',      'Ezri Konsa',          'DF', 28, true,  false, 12, 6, 5,  75, 42],
  ['av-torres',     'Pau Torres',          'DF', 29, false, false, 33, 5, 2,  95, 34],
  ['av-cash',       'Matty Cash',          'DF', 28, true,  false, 16, 6, 5,  60, 20],
  ['av-digne',      'Lucas Digne',         'DF', 32, false, false, 25, 4, 3,  85, 12],
  ['av-carlos',     'Diego Carlos',        'DF', 33, false, false, 26, 4, 3,  90,  6],
  ['av-maatsen',    'Ian Maatsen',         'DF', 24, true,  false, 37, 5, 1,  70, 40],
  ['av-lindelof',   'Victor Lindelöf',     'DF', 31, false, false,  0, 3, 0,  80, 10],
  ['av-mings',      'Tyrone Mings',        'DF', 32, true,  false, 20, 6, 5,  75, 12],
  ['av-kamara',     'Boubacar Kamara',     'MF', 26, false, false,  0, 5, 3,  95, 46],
  ['av-tielemans',  'Youri Tielemans',     'MF', 28, false, false,  0, 4, 2,  95, 40],
  ['av-mcginn',     'John McGinn',         'MF', 31, true,  false,  3, 6, 5,  80, 22],
  ['av-onana',      'Amadou Onana',        'MF', 24, false, false, 50, 5, 1,  90, 55],
  ['av-rogers',     'Morgan Rogers',       'MF', 23, true,  false, 16, 5, 1,  45, 70],
  ['av-buendia',    'Emiliano Buendía',    'MF', 29, false, false, 33, 5, 4,  75, 18],
  ['av-bailey',     'Leon Bailey',         'MF', 28, false, false, 30, 5, 4,  80, 30],
  ['av-tiel',       'Jaden Philogene',     'MF', 24, true,  true,   0, 4, 1,  40, 25],
  ['av-watkins',    'Ollie Watkins',       'FW', 30, true,  false, 28, 6, 5,  95, 55],
  ['av-duran',      'Jhon Durán',          'FW', 22, false, false, 18, 5, 2,  55, 60],
  ['av-barkley',    'Ross Barkley',        'MF', 32, true,  false,  5, 3, 1,  60, 10],
  ['av-iroegbunam', 'Tim Iroegbunam',      'MF', 21, true,  true,   0, 4, 1,  20, 12],
  ['av-swinkels',   'Kadan Swinkels',      'DF', 20, true,  true,   0, 3, 1,  10,  5],
];

// --- Newcastle United ------------------------------------------------------
const NEWCASTLE: Row[] = [
  ['nu-pope',      'Nick Pope',          'GK', 33, true,  false, 10, 5, 4,  70, 14],
  ['nu-dubravka',  'Martin Dúbravka',    'GK', 36, false, false,  4, 4, 3,  45,  3],
  ['nu-trippier',  'Kieran Trippier',    'DF', 35, true,  false, 12, 4, 3, 120,  8],
  ['nu-botman',    'Sven Botman',        'DF', 25, false, false, 32, 5, 3,  85, 45],
  ['nu-schar',     'Fabian Schär',       'DF', 34, false, false,  0, 3, 2,  60,  8],
  ['nu-burn',      'Dan Burn',           'DF', 33, true,  false, 13, 5, 4,  55, 10],
  ['nu-livramento','Tino Livramento',    'DF', 23, true,  false, 32, 6, 2,  60, 55],
  ['nu-hall',      'Lewis Hall',         'DF', 21, true,  false, 28, 6, 1,  50, 45],
  ['nu-guimaraes', 'Bruno Guimarães',    'MF', 28, false, false, 40, 6, 4, 150, 80],
  ['nu-tonali',    'Sandro Tonali',      'MF', 25, false, false, 55, 5, 2, 110, 65],
  ['nu-joelinton', 'Joelinton',          'MF', 29, false, false, 40, 6, 6,  95, 40],
  ['nu-longstaff', 'Sean Longstaff',     'MF', 28, true,  true,   0, 5, 3,  50, 18],
  ['nu-miley',     'Lewis Miley',        'MF', 20, true,  true,   0, 5, 2,  20, 20],
  ['nu-willock',   'Joe Willock',        'MF', 26, true,  false, 25, 6, 4,  70, 22],
  ['nu-murphy',    'Jacob Murphy',       'MF', 31, true,  false, 12, 5, 4,  55, 18],
  ['nu-gordon',    'Anthony Gordon',     'FW', 25, true,  false, 45, 6, 2,  90, 70],
  ['nu-isak',      'Alexander Isak',     'FW', 26, false, false, 63, 6, 3, 120,110],
  ['nu-barnes',    'Harvey Barnes',      'FW', 28, true,  false, 38, 5, 2,  75, 32],
  ['nu-osula',     'William Osula',      'FW', 22, false, false, 10, 5, 1,  25, 14],
  ['nu-krafth',    'Emil Krafth',        'DF', 31, false, false,  5, 4, 3,  35,  4],
];

// --- Nottingham Forest -----------------------------------------------------
const FOREST: Row[] = [
  ['nf-sels',       'Matz Sels',         'GK', 33, false, false,  5, 4, 1,  45, 12],
  ['nf-vlachodimos','Odysseas Vlachod.', 'GK', 31, false, false, 10, 4, 2,  40,  6],
  ['nf-milenkovic', 'Nikola Milenković', 'DF', 28, false, false, 12, 4, 1,  70, 35],
  ['nf-murillo',    'Murillo',           'DF', 23, false, false, 10, 6, 2,  50, 55],
  ['nf-aina',       'Ola Aina',          'DF', 29, true,  false,  0, 3, 1,  55, 22],
  ['nf-williams',   'Neco Williams',     'DF', 24, true,  false, 17, 5, 3,  45, 24],
  ['nf-toffolo',    'Harry Toffolo',     'DF', 30, true,  false,  2, 4, 3,  35,  6],
  ['nf-boly',       'Willy Boly',        'DF', 34, false, false,  0, 3, 2,  50,  3],
  ['nf-yates',      'Ryan Yates',        'MF', 28, true,  true,   0, 5, 3,  40, 14],
  ['nf-anderson',   'Elliot Anderson',   'MF', 23, true,  false, 35, 6, 1,  55, 55],
  ['nf-dominguez',  'Nicolás Domínguez', 'MF', 27, false, false, 15, 5, 2,  50, 22],
  ['nf-gibbswhite', 'Morgan Gibbs-White','MF', 26, true,  false, 25, 6, 3,  80, 60],
  ['nf-sangare',    'Ibrahim Sangaré',   'MF', 28, false, false, 26, 5, 2,  65, 20],
  ['nf-elanga',     'Anthony Elanga',    'FW', 24, true,  false, 15, 5, 2,  55, 45],
  ['nf-hudsonodoi', 'Callum Hudson-Odoi','FW', 25, true,  false,  5, 5, 2,  60, 35],
  ['nf-wood',       'Chris Wood',        'FW', 34, false, false, 15, 3, 2,  70, 12],
  ['nf-awoniyi',    'Taiwo Awoniyi',     'FW', 28, false, false, 17, 5, 4,  60, 22],
  ['nf-moraissa',   'Zach Abbott',       'DF', 20, true,  true,   0, 4, 1,  10,  6],
];

// --- Everton ---------------------------------------------------------------
const EVERTON: Row[] = [
  ['ev-pickford',  'Jordan Pickford',   'GK', 32, true,  false, 30, 6, 5, 110, 28],
  ['ev-virginia',  'João Virgínia',     'GK', 26, false, false,  1, 4, 3,  20,  3],
  ['ev-tarkowski', 'James Tarkowski',   'DF', 33, true,  false,  0, 4, 3,  70, 12],
  ['ev-branthwaite','Jarrad Branthwaite','DF',23, true,  false,  1, 6, 3,  40, 65],
  ['ev-mykolenko', 'Vitaliy Mykolenko', 'DF', 26, false, false, 17, 6, 4,  50, 22],
  ['ev-patterson', 'Nathan Patterson',  'DF', 24, true,  false, 12, 5, 4,  40, 12],
  ['ev-coleman',   'Seamus Coleman',    'DF', 37, true,  false,  1, 2, 1,  45,  1],
  ['ev-oshea',     'Jake O’Brien', 'DF', 25, false, false, 17, 5, 1,  40, 26],
  ['ev-garner',    'James Garner',      'MF', 25, true,  false, 15, 5, 3,  45, 26],
  ['ev-gueye',     'Idrissa Gueye',     'MF', 36, false, false,  0, 2, 1,  60,  3],
  ['ev-doucoure',  'Abdoulaye Doucouré','MF', 33, false, false, 20, 4, 3,  70, 10],
  ['ev-mcneil',    'Dwight McNeil',     'MF', 26, true,  false, 20, 5, 3,  55, 30],
  ['ev-onyango',   'Tyler Onyango',     'MF', 22, true,  true,   0, 4, 2,  15,  6],
  ['ev-ndiaye',    'Iliman Ndiaye',     'FW', 25, false, false, 15, 5, 1,  50, 32],
  ['ev-calvertlew','Dominic Calvert-L.','FW', 28, true,  true,   0, 5, 4,  85, 25],
  ['ev-beto',      'Beto',              'FW', 28, false, false, 26, 5, 2,  45, 15],
  ['ev-broja',     'Armando Broja',     'FW', 24, true,  false, 20, 5, 1,  40, 14],
  ['ev-chermiti',  'Youssef Chermiti',  'FW', 21, false, false, 15, 5, 2,  25, 12],
];

// --- The market: elsewhere in Europe, and free agents ----------------------
const MARKET: Row[] = [
  ['mk-osimhen',   'Victor Osimhen',     'FW', 27, false, false, 70, 5, 3, 200,110],
  ['mk-sesko',     'Benjamin Šeško',     'FW', 22, false, false, 24, 5, 1,  90, 85],
  ['mk-gyokeres',  'Viktor Gyökeres',    'FW', 27, false, false, 20, 5, 2,  70, 90],
  ['mk-zirkzee',   'Joshua Zirkzee',     'FW', 25, false, false, 37, 5, 1,  85, 40],
  ['mk-openda',    'Loïs Openda',        'FW', 26, false, false, 38, 5, 2,  80, 55],
  ['mk-david',     'Jonathan David',     'FW', 26, false, false,  0, 4, 4,  60, 45],
  ['mk-kolomuani', 'Randal Kolo Muani',  'FW', 27, false, false, 80, 5, 2,  95, 45],
  ['mk-wirtz',     'Florian Wirtz',      'MF', 23, false, false,  0, 5, 3, 130,130],
  ['mk-olise',     'Michael Olise',      'MF', 24, true,  false, 50, 5, 1, 100, 90],
  ['mk-baleba',    'Carlos Baleba',      'MF', 22, false, false, 23, 6, 2,  50, 70],
  ['mk-wharton',   'Adam Wharton',       'MF', 22, true,  false, 22, 6, 2,  45, 65],
  ['mk-doue',      'Désiré Doué',        'MF', 21, false, false, 50, 5, 1,  70, 75],
  ['mk-kone',      'Manu Koné',          'MF', 25, false, false, 18, 5, 1,  60, 45],
  ['mk-smithrowe', 'Emile Smith Rowe',   'MF', 25, true,  false, 27, 5, 1,  55, 35],
  ['mk-guehi',     'Marc Guéhi',         'DF', 26, true,  false, 18, 5, 4,  60, 60],
  ['mk-hato',      'Jorrel Hato',        'DF', 20, false, false,  0, 5, 3,  35, 45],
  ['mk-todibo',    'Jean-Clair Todibo',  'DF', 26, false, false, 26, 5, 2,  55, 35],
  ['mk-colwill',   'Levi Colwill',       'DF', 23, true,  false,  0, 6, 3,  70, 55],
  ['mk-tomiyasu',  'Takehiro Tomiyasu',  'DF', 27, false, false, 20, 5, 4,  70, 12],
  ['mk-diouf',     'Andy Diouf',         'DF', 23, false, false, 10, 5, 2,  35, 25],
  ['mk-donnarumma','Gianluigi Donnar.',  'GK', 27, false, false,  0, 5, 5, 140, 55],
  ['mk-kepa',      'Kepa Arrizabalaga',  'GK', 31, false, false,  0, 3, 1,  90, 10],
  ['mk-bijlow',    'Justin Bijlow',      'GK', 28, false, false,  5, 4, 2,  35, 10],
  ['mk-branco',    'Rav van den Berg',   'DF', 22, false, false,  4, 5, 2,  25, 18],
];

export const PLAYERS: Player[] = [
  ...expand('aston-villa', VILLA),
  ...expand('newcastle', NEWCASTLE),
  ...expand('forest', FOREST),
  ...expand('everton', EVERTON),
  ...expand(null, MARKET),
];

export function playerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}
