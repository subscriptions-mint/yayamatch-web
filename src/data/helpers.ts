// Sample helper profiles (fictional). Photos are sample images in the YayaMatch uniform.
import type { Helper } from '../lib/types';

export const HELPERS: Helper[] = [
 {
  "id": "h-01",
  "firstName": "Rosalinda",
  "lastInitial": "D",
  "gender": "f",
  "age": 38,
  "roles": [
   "nanny",
   "housekeeper"
  ],
  "years": 12,
  "city": "makati",
  "rate": 14000,
  "arrangement": "livein",
  "languages": [
   "tagalog",
   "english"
  ],
  "bio": "Twelve years caring for little ones in Makati. Patient, organized, and I love packing baon for school days.",
  "skills": [
   "childcare",
   "cooking",
   "laundry",
   "firstaid"
  ],
  "experience": [
   {
    "years": "2019–2025",
    "text": "Family in Makati, 2 kids (3 and 6)"
   },
   {
    "years": "2014–2019",
    "text": "Family in Pasig, newborn until age 5"
   },
   {
    "years": "2013–2014",
    "text": "Daycare assistant, Batangas"
   }
  ],
  "schedule": "Can start in 2 weeks · Sundays off",
  "startIn": "2weeks",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "philid",
    "month": "2026-09"
   },
   "nbi": "2027-08",
   "refs": {
    "n": 3,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Our kids adored her. Always on time with naps and meals.",
    "who": "Reyes family · Makati"
   },
   {
    "text": "Five years with us. Parang kapamilya na talaga.",
    "who": "Cruz family · Pasig"
   },
   {
    "text": "Very organized, kept a daily log for us.",
    "who": "Lim family · Makati"
   }
  ],
  "photo": "rosalinda.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 24,
   "script": "Hello po! Ako si Rosalinda, labindalawang taon na akong yaya dito sa Makati. Mahilig ako sa routine: tulog, kain, laro, at baon tuwing may pasok."
  },
  "favorite": "Packing baon for school days."
 },
 {
  "id": "h-02",
  "firstName": "Jenny",
  "lastInitial": "P",
  "gender": "f",
  "age": 29,
  "roles": [
   "housekeeper",
   "cook"
  ],
  "years": 6,
  "city": "qc",
  "rate": 11000,
  "arrangement": "liveout",
  "languages": [
   "tagalog",
   "english",
   "bisaya"
  ],
  "bio": "Masarap ako magluto, lalo na sinigang at adobo. Malinis sa bahay at maayos sa laundry.",
  "skills": [
   "cooking",
   "laundry"
  ],
  "experience": [
   {
    "years": "2021–2025",
    "text": "Family of 5 in Quezon City"
   },
   {
    "years": "2019–2021",
    "text": "Kitchen helper, carinderia in Cubao"
   }
  ],
  "schedule": "Weekdays, 7 AM to 5 PM · Start next month",
  "startIn": "1month",
  "daysOff": [
   "sat",
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "philid",
    "month": "2026-10"
   },
   "nbi": "2027-05",
   "refs": {
    "n": 2,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Best kare-kare we've had at home.",
    "who": "Santos family · QC"
   },
   {
    "text": "Neat, quiet and reliable every single day.",
    "who": "Aquino family · QC"
   }
  ],
  "photo": "jenny.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 31,
   "script": "Hi po, ako si Jenny. Anim na taon na akong kasambahay at tagaluto. Specialty ko ang sinigang at adobo, at maayos ako sa laundry."
  },
  "favorite": "Sunday sinigang na ulit-ulitin ng buong pamilya."
 },
 {
  "id": "h-03",
  "firstName": "Maricel",
  "lastInitial": "A",
  "gender": "f",
  "age": 45,
  "roles": [
   "caregiver"
  ],
  "years": 15,
  "city": "pasig",
  "rate": 16000,
  "arrangement": "livein",
  "languages": [
   "tagalog",
   "english",
   "ilocano"
  ],
  "bio": "Caregiver for the elderly for 15 years. Marunong mag-BP check at mag-manage ng gamot. Mahaba ang pasensya ko.",
  "skills": [
   "firstaid",
   "cooking",
   "laundry"
  ],
  "experience": [
   {
    "years": "2018–2025",
    "text": "Cared for a lolo with diabetes, Pasig"
   },
   {
    "years": "2012–2018",
    "text": "Bedridden lola, post-stroke care, Marikina"
   },
   {
    "years": "2010–2012",
    "text": "Home care agency aide"
   }
  ],
  "schedule": "Available now · 1 day off a week",
  "startIn": "now",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "umid",
    "month": "2026-10"
   },
   "nbi": "2027-03",
   "refs": {
    "n": 3,
    "month": "2026-10"
   },
   "tesda": "caregiving",
   "medical": "2026-09"
  },
  "quotes": [
   {
    "text": "She treated Papa with so much dignity. We trust her completely.",
    "who": "Tan family · Pasig"
   },
   {
    "text": "Kalmado at maalaga. Never missed a medicine schedule.",
    "who": "Ramos family · Marikina"
   },
   {
    "text": "Very knowledgeable about elderly care.",
    "who": "Go family · Pasig"
   },
   {
    "text": "Kind, honest and strong.",
    "who": "Uy family · San Juan"
   }
  ],
  "photo": "maricel.jpg",
  "likedYou": true,
  "topPick": true,
  "voice": {
   "sec": 26,
   "script": "Magandang araw po. Ako si Maricel, caregiver ng mga lolo at lola sa loob ng labinlimang taon. Marunong ako mag-BP check at mag-ayos ng gamot."
  },
  "favorite": "When Lolo laughs at my kwento after his medicine."
 },
 {
  "id": "h-05",
  "firstName": "Lorna",
  "lastInitial": "C",
  "gender": "f",
  "age": 52,
  "roles": [
   "allaround"
  ],
  "years": 24,
  "city": "manila",
  "rate": 13000,
  "arrangement": "livein",
  "languages": [
   "tagalog",
   "bisaya"
  ],
  "bio": "Mahigit 20 taon na akong kasambahay, kasama ang apat na taon sa Hong Kong. Ako na bahala sa luto, linis, at laba. Parang pamilya ko na ang inaalagaan ko.",
  "skills": [
   "cooking",
   "laundry",
   "childcare"
  ],
  "experience": [
   {
    "years": "2010–2025",
    "text": "One family in Malate, kids grown up with me"
   },
   {
    "years": "2005–2010",
    "text": "Household of 7 in Sampaloc"
   },
   {
    "years": "2001–2005",
    "text": "Family with 2 kids, Hong Kong"
   }
  ],
  "schedule": "Available in 1 month · Sunday off",
  "startIn": "1month",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "philid",
    "month": "2026-09"
   },
   "nbi": "2027-06",
   "refs": {
    "n": 2,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Fifteen years with us. She raised our kids with love.",
    "who": "Villanueva family · Malate"
   },
   {
    "text": "Masipag at tapat. Hindi ka magsisisi.",
    "who": "Dizon family · Sampaloc"
   }
  ],
  "photo": "lorna.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 33,
   "script": "Ako po si Lorna. Mahigit dalawampung taon na akong kasambahay, kasama ang apat na taon sa Hong Kong. Ako na po ang bahala sa bahay."
  },
  "favorite": "Seeing the kids I raised graduate."
 },
 {
  "id": "h-06",
  "firstName": "Arnel",
  "lastInitial": "G",
  "gender": "m",
  "age": 41,
  "roles": [
   "driver"
  ],
  "years": 14,
  "city": "makati",
  "rate": 18000,
  "arrangement": "liveout",
  "languages": [
   "tagalog",
   "english"
  ],
  "bio": "Professional driver, no violations on my record. Kabisado ang Metro Manila at school runs. Maingat at laging on time.",
  "skills": [
   "driving"
  ],
  "experience": [
   {
    "years": "2016–2025",
    "text": "Family driver, Makati to Alabang school runs"
   },
   {
    "years": "2011–2016",
    "text": "Company service driver, Ortigas"
   }
  ],
  "schedule": "Mon–Sat · Can start next week",
  "startIn": "2weeks",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "license",
    "month": "2026-10"
   },
   "nbi": "2027-08",
   "refs": {
    "n": 3,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Calm driver, the kids felt safe every day.",
    "who": "Ocampo family · Makati"
   },
   {
    "text": "Always early, car always clean.",
    "who": "Yap family · Makati"
   }
  ],
  "photo": "arnel.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 28,
   "script": "Good day po, ako si Arnel. Labing-apat na taon na akong driver. Kabisado ko ang Makati hanggang Alabang, at laging maaga."
  },
  "favorite": "Getting the kids to school early, kahit traffic."
 },
 {
  "id": "h-07",
  "firstName": "Grace",
  "lastInitial": "T",
  "gender": "f",
  "age": 33,
  "roles": [
   "nanny"
  ],
  "years": 9,
  "city": "cebu",
  "rate": 9500,
  "arrangement": "livein",
  "languages": [
   "bisaya",
   "tagalog",
   "english"
  ],
  "bio": "Mahilig ako sa bata. 9 years as yaya, marunong mag-first aid at mag-prepare ng baby food.",
  "skills": [
   "childcare",
   "firstaid",
   "cooking"
  ],
  "experience": [
   {
    "years": "2020–2025",
    "text": "Twins from 6 months to 5 years, Cebu City"
   },
   {
    "years": "2016–2020",
    "text": "Family with a toddler, Mandaue"
   }
  ],
  "schedule": "Available now",
  "startIn": "now",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "philid",
    "month": "2026-10"
   },
   "nbi": "2027-05",
   "refs": {
    "n": 2,
    "month": "2026-10"
   },
   "medical": "2026-09"
  },
  "quotes": [
   {
    "text": "Handled our twins like a pro. Lovely with babies.",
    "who": "Garcia family · Cebu City"
   },
   {
    "text": "Gentle and very clean with baby bottles and food.",
    "who": "Lao family · Mandaue"
   }
  ],
  "photo": "grace.jpg",
  "likedYou": true,
  "topPick": false,
  "voice": {
   "sec": 35,
   "script": "Maayong adlaw! Ako si Grace, siyam na taon nang yaya. Nag-alaga ako ng kambal, at marunong ako sa first aid at baby food."
  },
  "favorite": "First steps and first words. Twice, with twins!"
 },
 {
  "id": "h-10",
  "firstName": "Mylene",
  "lastInitial": "R",
  "gender": "f",
  "age": 36,
  "roles": [
   "cook"
  ],
  "years": 11,
  "city": "bgc",
  "rate": 17000,
  "arrangement": "liveout",
  "languages": [
   "tagalog",
   "english",
   "hiligaynon"
  ],
  "bio": "Cooked for families and a small catering business. Kaya ko ang Filipino, Japanese, at healthy meal prep.",
  "skills": [
   "cooking"
  ],
  "experience": [
   {
    "years": "2019–2025",
    "text": "Private cook for an expat family, BGC"
   },
   {
    "years": "2014–2019",
    "text": "Catering cook, Iloilo City"
   }
  ],
  "schedule": "Mon–Fri, lunch and dinner",
  "startIn": "2weeks",
  "daysOff": [
   "sat",
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "umid",
    "month": "2026-09"
   },
   "nbi": "2027-03",
   "refs": {
    "n": 3,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Her katsu and sinigang are both amazing.",
    "who": "Nakamura family · BGC"
   },
   {
    "text": "Weekly meal prep saved our weeknights.",
    "who": "Fernandez family · Makati"
   },
   {
    "text": "Clean kitchen, smart grocery budget.",
    "who": "Aguilar family · BGC"
   }
  ],
  "photo": "mylene.jpg",
  "likedYou": true,
  "topPick": false,
  "voice": {
   "sec": 30,
   "script": "Hi! Ako si Mylene. Nagluto ako para sa mga pamilya at catering. Kaya ko ang Filipino, Japanese, at healthy meal prep."
  },
  "favorite": "Planning a week of meals the family looks forward to."
 },
 {
  "id": "h-11",
  "firstName": "Rodel",
  "lastInitial": "S",
  "gender": "m",
  "age": 48,
  "roles": [
   "driver",
   "allaround"
  ],
  "years": 16,
  "city": "pasig",
  "rate": 15000,
  "arrangement": "livein",
  "languages": [
   "tagalog",
   "english"
  ],
  "bio": "Driver at all-around sa bahay. Marunong din sa minor repairs at garden. Responsable at maaasahan.",
  "skills": [
   "driving",
   "laundry"
  ],
  "experience": [
   {
    "years": "2012–2025",
    "text": "Driver and handyman for a family in Pasig"
   },
   {
    "years": "2009–2012",
    "text": "Delivery driver"
   }
  ],
  "schedule": "Available in 1 month",
  "startIn": "1month",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "refs": {
    "n": 2,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Fixes everything, drives safely, always polite.",
    "who": "Domingo family · Pasig"
   }
  ],
  "photo": "rodel.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 25,
   "script": "Ako po si Rodel, driver at all-around. Marunong din ako sa minor repairs at garden. Responsable po ako."
  },
  "favorite": "Fixing things before anyone notices they broke."
 },
 {
  "id": "h-13",
  "firstName": "Cecilia",
  "lastInitial": "L",
  "gender": "f",
  "age": 42,
  "roles": [
   "nanny",
   "caregiver"
  ],
  "years": 13,
  "city": "makati",
  "rate": 15500,
  "arrangement": "livein",
  "languages": [
   "tagalog",
   "english",
   "ilocano"
  ],
  "bio": "I've cared for newborns and for a lola with dementia. Gentle, calm, and I keep a care log for parents.",
  "skills": [
   "childcare",
   "firstaid",
   "cooking"
  ],
  "experience": [
   {
    "years": "2020–2025",
    "text": "Newborn care, family in Makati"
   },
   {
    "years": "2015–2020",
    "text": "Lola with dementia, Parañaque"
   },
   {
    "years": "2012–2015",
    "text": "Nanny for 3 kids, Laoag"
   }
  ],
  "schedule": "Can start in 3 weeks",
  "startIn": "2weeks",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "philid",
    "month": "2026-10"
   },
   "nbi": "2027-08",
   "refs": {
    "n": 3,
    "month": "2026-10"
   },
   "medical": "2026-09"
  },
  "quotes": [
   {
    "text": "Our first baby, and she made us feel so prepared.",
    "who": "Mendoza family · Makati"
   },
   {
    "text": "So patient with our lola. Forever grateful.",
    "who": "Salazar family · Parañaque"
   },
   {
    "text": "Strict but loving with the kids.",
    "who": "Rivera family · Laoag"
   }
  ],
  "photo": "cecilia.jpg",
  "likedYou": true,
  "topPick": false,
  "voice": {
   "sec": 32,
   "script": "Hello po, ako si Cecilia. Nag-alaga ako ng mga newborn at ng isang lola na may dementia. Kalmado ako at may care log para sa mga magulang."
  },
  "favorite": "Keeping a care log so parents never miss a thing."
 },
 {
  "id": "h-14",
  "firstName": "Divina",
  "lastInitial": "O",
  "gender": "f",
  "age": 50,
  "roles": [
   "allaround"
  ],
  "years": 23,
  "city": "cebu",
  "rate": 10500,
  "arrangement": "livein",
  "languages": [
   "bisaya",
   "english"
  ],
  "bio": "Kapin 20 ka tuig nga kasinatian, upat ka tuig sa Singapore. Limpyo, luto, ug alaga sa bata. Honest and hardworking.",
  "skills": [
   "cooking",
   "laundry",
   "childcare"
  ],
  "experience": [
   {
    "years": "2014–2025",
    "text": "Household in Lahug, Cebu City"
   },
   {
    "years": "2006–2014",
    "text": "Family in Talisay, 4 kids"
   },
   {
    "years": "2002–2006",
    "text": "Household helper, Singapore"
   }
  ],
  "schedule": "Available in 2 weeks",
  "startIn": "2weeks",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "philid",
    "month": "2026-09"
   },
   "nbi": "2027-05",
   "refs": {
    "n": 2,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Our home ran smoothly for 11 years.",
    "who": "Osmeña family · Cebu City"
   },
   {
    "text": "Maayo kaayo mo-luto. Limpyo pa mo-trabaho.",
    "who": "Abellana family · Talisay"
   }
  ],
  "photo": "divina.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 27,
   "script": "Maayong adlaw, ako si Divina. Kapin 20 ka tuig nga kasinatian sa balay. Limpyo, luto, ug alaga sa bata."
  },
  "favorite": "A clean kitchen and a full rice pot."
 },
 {
  "id": "h-15",
  "firstName": "Ramil",
  "lastInitial": "P",
  "gender": "m",
  "age": 31,
  "roles": [
   "driver"
  ],
  "years": 7,
  "city": "bgc",
  "rate": 19000,
  "arrangement": "liveout",
  "languages": [
   "tagalog",
   "english"
  ],
  "bio": "Ride-hailing driver turned family driver. Defensive driving certified. Malinis ang record, palaging maaga.",
  "skills": [
   "driving"
  ],
  "experience": [
   {
    "years": "2022–2025",
    "text": "Family driver, BGC and Alabang"
   },
   {
    "years": "2018–2022",
    "text": "Ride-hailing driver, Metro Manila"
   }
  ],
  "schedule": "Mon–Fri · Start next week",
  "startIn": "2weeks",
  "daysOff": [
   "sat",
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "refs": {
    "n": 2,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Knows every shortcut and still drives carefully.",
    "who": "Ilagan family · BGC"
   }
  ],
  "photo": "ramil.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 34,
   "script": "Hi po, ako si Ramil, family driver. Defensive driving certified at malinis ang record ko."
  },
  "favorite": "Quiet, careful drives. No sudden brakes."
 },
 {
  "id": "h-18",
  "firstName": "Sheila",
  "lastInitial": "M",
  "gender": "f",
  "age": 34,
  "roles": [
   "caregiver"
  ],
  "years": 8,
  "city": "manila",
  "rate": 13500,
  "arrangement": "liveout",
  "languages": [
   "tagalog",
   "english"
  ],
  "bio": "Caregiver NC II holder. Experienced with post-stroke care, wheelchair transfers, and meal schedules.",
  "skills": [
   "firstaid",
   "cooking"
  ],
  "experience": [
   {
    "years": "2021–2025",
    "text": "Post-stroke care for a retired teacher, Manila"
   },
   {
    "years": "2017–2021",
    "text": "Nursing home aide, Quezon City"
   }
  ],
  "schedule": "Day shift, 6 days a week",
  "startIn": "2weeks",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "philid",
    "month": "2026-10"
   },
   "nbi": "2027-06",
   "refs": {
    "n": 3,
    "month": "2026-10"
   },
   "tesda": "caregiving"
  },
  "quotes": [
   {
    "text": "Dad walks again with a cane. Her routine made a real difference.",
    "who": "Pascual family · Manila"
   },
   {
    "text": "Professional and very warm.",
    "who": "Javier family · Manila"
   },
   {
    "text": "Great with doctors' instructions.",
    "who": "Cortez family · Sta. Mesa"
   }
  ],
  "photo": "sheila.jpg",
  "likedYou": false,
  "topPick": true,
  "voice": {
   "sec": 29,
   "script": "Good day po. Ako si Sheila, caregiver na may NC II. May karanasan ako sa post-stroke care at wheelchair transfers."
  },
  "favorite": "Watching a patient get stronger week by week."
 },
 {
  "id": "h-19",
  "firstName": "Liza",
  "lastInitial": "E",
  "gender": "f",
  "age": 39,
  "roles": [
   "housekeeper",
   "cook"
  ],
  "years": 10,
  "city": "pasig",
  "rate": 12500,
  "arrangement": "livein",
  "languages": [
   "tagalog",
   "hiligaynon"
  ],
  "bio": "Sampung taon sa pag-aalaga ng bahay. Mahusay sa laundry at plantsa. Tahimik pero masayahin.",
  "skills": [
   "laundry",
   "cooking"
  ],
  "experience": [
   {
    "years": "2016–2025",
    "text": "Household of 4 in Pasig"
   },
   {
    "years": "2015–2016",
    "text": "Laundry shop, Bacolod"
   }
  ],
  "schedule": "Available in 2 weeks",
  "startIn": "2weeks",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "refs": {
    "n": 2,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Our uniforms never looked so crisp.",
    "who": "Gonzales family · Pasig"
   },
   {
    "text": "Quiet, efficient, and trustworthy.",
    "who": "Medina family · Pasig"
   }
  ],
  "photo": "liza.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 24,
   "script": "Ako po si Liza. Sampung taon na sa pag-aalaga ng bahay. Mahusay ako sa laundry at plantsa."
  },
  "favorite": "Crisp, ironed uniforms on Monday morning."
 },
 {
  "id": "h-20",
  "firstName": "Bernadette",
  "lastInitial": "K",
  "gender": "f",
  "age": 30,
  "roles": [
   "nanny"
  ],
  "years": 6,
  "city": "bgc",
  "rate": 16000,
  "arrangement": "liveout",
  "languages": [
   "english",
   "tagalog"
  ],
  "bio": "Worked with expat families for 6 years. Fluent English, I help with homework and swim lesson drop-offs.",
  "skills": [
   "childcare",
   "tutoring",
   "firstaid"
  ],
  "experience": [
   {
    "years": "2022–2025",
    "text": "Australian family in BGC, 2 kids (5 and 8)"
   },
   {
    "years": "2019–2022",
    "text": "Korean family in Makati, 1 kid"
   }
  ],
  "schedule": "Weekdays · Start next month",
  "startIn": "1month",
  "daysOff": [
   "sat",
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "philid",
    "month": "2026-10"
   },
   "nbi": "2027-05",
   "refs": {
    "n": 3,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Our kids' favourite person in Manila.",
    "who": "Walker family · BGC"
   },
   {
    "text": "Reliable, warm and great with homework.",
    "who": "Kim family · Makati"
   }
  ],
  "photo": "bernadette.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 31,
   "script": "Hi! I am Bernadette. I have worked with expat families for six years. I help with homework and school drop-offs."
  },
  "favorite": "Homework time that ends with a high five."
 },
 {
  "id": "h-21",
  "firstName": "Noel",
  "lastInitial": "A",
  "gender": "m",
  "age": 44,
  "roles": [
   "allaround",
   "driver"
  ],
  "years": 12,
  "city": "cebu",
  "rate": 11000,
  "arrangement": "livein",
  "languages": [
   "bisaya",
   "tagalog"
  ],
  "bio": "All-around sa bahay: driver, hardinero, ayos ng gripo at kuryente. Kasama ang pamilya, parang tito na.",
  "skills": [
   "driving",
   "petcare"
  ],
  "experience": [
   {
    "years": "2013–2025",
    "text": "Family in Banilad, Cebu City"
   },
   {
    "years": "2010–2013",
    "text": "Resort maintenance, Mactan"
   }
  ],
  "schedule": "Available in 1 month",
  "startIn": "1month",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "refs": {
    "n": 1,
    "month": "2026-10"
   }
  },
  "quotes": [
   {
    "text": "Handy, honest, and great with our dogs.",
    "who": "Sy family · Cebu City"
   }
  ],
  "photo": "noel.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 26,
   "script": "Ako si Noel, all-around sa bahay: driver, hardinero, at ayos ng gripo. Mahal ko rin ang mga aso."
  },
  "favorite": "Weekend garden days with the family dogs."
 },
 {
  "id": "h-23",
  "firstName": "Gemma",
  "lastInitial": "H",
  "gender": "f",
  "age": 53,
  "roles": [
   "caregiver"
  ],
  "years": 20,
  "city": "qc",
  "rate": 22000,
  "arrangement": "livein",
  "languages": [
   "tagalog",
   "english",
   "ilocano"
  ],
  "bio": "Former hospital nursing aide, now a private caregiver for 20 years. Trained in tube feeding and wound care.",
  "skills": [
   "firstaid",
   "cooking",
   "laundry"
  ],
  "experience": [
   {
    "years": "2016–2025",
    "text": "Private caregiver, retired judge, Quezon City"
   },
   {
    "years": "2005–2016",
    "text": "Nursing aide, private hospital"
   }
  ],
  "schedule": "Available in 2 weeks · 1 day off a week",
  "startIn": "2weeks",
  "daysOff": [
   "sun"
  ],
  "checks": {
   "phone": "2026-10",
   "id": {
    "type": "passport",
    "month": "2026-09"
   },
   "nbi": "2027-06",
   "refs": {
    "n": 3,
    "month": "2026-10"
   },
   "tesda": "caregiving",
   "medical": "2026-09"
  },
  "quotes": [
   {
    "text": "Hospital-level care at home. Truly exceptional.",
    "who": "Manalo family · QC"
   },
   {
    "text": "Calm in every emergency.",
    "who": "Robles family · QC"
   },
   {
    "text": "Mama was in the best hands.",
    "who": "Espino family · Mandaluyong"
   }
  ],
  "photo": "gemma.jpg",
  "likedYou": false,
  "topPick": false,
  "voice": {
   "sec": 33,
   "script": "Magandang araw po, ako si Gemma. Dalawampung taon na akong caregiver, dating nursing aide sa ospital."
  },
  "favorite": "Calm, steady care, even on hard days."
 }
];
