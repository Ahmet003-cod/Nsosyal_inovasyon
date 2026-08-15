// badwords.js - Genişletilmiş Argo ve Küfür Filtre Listesi (500+ Kelime ve Varyasyonu)
const badWords = [
  // A - Anlaşılmayanlar, Am ve Ananı Kelime Grubu / Varyasyonları
  "amk", "aq", "amq", "amkuran", "amkodumun", "amkdumun", "amcik", "amcık", "amkoyayim", 
  "amkoyim", "amkoydugum", "amkoydugumun", "amsalak", "amsiz", "amsız", "ambiti", "ambiti",
  "amcuk", "amcugum", "amciklar", "amcıklar", "amciga", "amcığa", "amcikten", "amcikten",
  "amfidesi", "amkafali", "amkafanli", "amlicik", "amlama", "amsalaki", "amguard", "amguardlik",
  "anal", "anani", "ananiz", "ananisikeyim", "ananisikim", "anasini", "anasi", "anasinin",
  "ananin", "ananizin", "anancilik", "ananizi", "anasiz", "anasız", "anasini-siktigim",
  "orospu", "orospucocugu", "oc", "o.c", "o.ç", "orospuçocuğu", "orospunun", "orospular",
  "orospulik", "orospu-evladi", "orospuevladi", "o_c", "o-c", "o-ç", "orjinalorospu",
  "avrat", "avradini", "avradinisiktigim", "amip", "amk-cocugu", "amq-cocugu",

  // B - Bacı, Bok, Bitch ve Varyasyonları
  "bacini", "bacinisikeyim", "bacinizin", "bacisina", "bacisiz", "bok", "bokten", "boktan",
  "bokubokuna", "boklama", "bokye", "boklu", "bityavrusu", "bitch", "bitches", "bastard",
  "bullshit", "blowjob", "boob", "boobs", "bugger", "booster-göt", "bokcuk", "boktanlar",

  // C - Ç - Cinsel İçerik, Çük, Cuk ve Varyasyonları
  "cacik", "cuk", "cuckold", "cük", "cuksuz", "cüksüz", "cibilliyetsiz", "cibiliyetini",
  "cinsini", "cinsinisiktigim", "cinsinizi", "cinsisikik",

  // D - Dalyarak, Daşşak, Domal ve Varyasyonları
  "dalyarak", "dalyarrak", "dashak", "dassak", "daşşak", "dassakli", "daşşaklı", "dassagimi",
  "daşşamı", "dassaginisikim", "domal", "domaltayim", "domaltirim", "domalan", "domalma",
  "dudak", "dingil", "dingilsiz", "durtuk", "durtukleme", "dick", "dicks", "dildo", 
  "dumbass", "dipshit", "douche", "douchebag",

  // F - Fahişe, Fuck ve Varyasyonları
  "fahişe", "fahise", "fahiseler", "fahiselik", "fuck", "fucker", "fucking", "fucked",
  "fuckoff", "fuckup", "faggot", "fatass", "fuckerz",

  // G - Göt, Götveren, Göğüs ve Varyasyonları
  "got", "göt", "gotveren", "götveren", "götlek", "gotlek", "gotogiren", "götögiren",
  "gotos", "götoş", "gotcu", "götçü", "gotunu", "götünü", "gotun", "götün", "gotunuzu",
  "götünüzü", "gotume", "götüme", "gotunde", "götünde", "gotunden", "götunden", "gotverenler",
  "gotoglani", "götoğlanı", "gotdeligi", "götdeliği", "goturak", "gotlusu", "gotten", "götten",
  "gottensikis", "göttensikiş", "gay", "gaysiz", "gospit",

  // H - İ - Hakaretler, İbne, İbine ve Varyasyonları
  "habas", "hayırsız", "hayirsiz", "haysiyetsiz", "haysiyetsizler", "haysiyetini",
  "ibne", "ibine", "ibneler", "ibnelik", "ibneliğine", "ibneliğine", "ibnece", "ibnem",
  "ibnesi", "ibnelerin", "it", "itoglu", "itoğlu", "itogluit", "itoğluit", "itler",
  "ipne", "ipnelik",

  // K - Kahpe, Kaltak, Kavat, Koyayım ve Varyasyonları
  "kahpe", "kahpeçocuğu", "kahpecocugu", "kahpeler", "kahpelik", "kaltak", "kaltaklar",
  "kaltaklik", "kavat", "kavadd", "kavatlar", "kavatlik", "koyim", "koyayim", "koyayım",
  "koydugum", "koyduğum", "kopek", "köpek", "kopekler", "köpekler", "kancik", "kançık",
  "kançıklar", "kanciklik", "kaltakca", "keko", "keko-pici", "kancigin-evladi",

  // M - N - O - P - Pezevenk, Piç, Püşt ve Varyasyonları
  "nanay", "orspu", "oruspu", "orospular", "otuzbir", "31", "pezevenk", "pezeveng",
  "pezevenkler", "pezevenklik", "piç", "pic", "piçler", "picler", "pici", "piçi",
  "picinin", "piçinin", "picleme", "piçleme", "püst", "püşt", "pust", "püştler",
  "pussy", "prick", "piss", "pissing", "porn", "porno", "pussycat",

  // S - Ş - Sik, Sikiş, Siktir, Sokarım ve Varyasyonları
  "sakso", "saksocu", "saksofoncu", "salak", "salaklar", "salaklik", "salakca",
  "sik", "siki", "sikim", "sikiş", "sikis", "sikismek", "sikitim", "sikeyim", 
  "sikimle", "siktir", "siktirgit", "siktiğim", "siktiğimin", "siktiyim", "siktiyimin",
  "sokaim", "sokarim", "sokayım", "sokayim", "sikilir", "sikilmis", "sikilmiş",
  "sikilme", "sikimsonik", "siksok", "sikperest", "sikkafali", "sikkafalı", "sikisgen",
  "sikisgan", "sikitimin", "siktimin", "siktir-git", "siktirici", "sikmish", "siktirlan",
  "siktirin", "siktiriniz", "shit", "slut", "sonofabitch", "sex", "seks", "seksist",

  // T - Y - Yarrak, Yavşak, Yosma ve Varyasyonları
  "tasak", "taşak", "tasakli", "taşaklı", "tasagim", "daşak", "tokmak", "tokmakci",
  "yarrak", "yarak", "yarrrak", "yarasam", "yaragim", "yarağım", "yaramin", "yaramın",
  "yaragimi", "yarağımı", "yarakkafali", "yarakkafalı", "yarakci", "yarraksiz",
  "yavsak", "yavşak", "yavsaklar", "yavsaklik", "yosma", "yamyam", "yosmalar",

  // Ekstra Hakaret ve Şüpheli İfadeler
  "aptal", "gerzek", "gerizekalı", "gerizekali", "sahtekar", "sahtekâr", "dolandırıcı", "dolandirici",
  "hırsız", "hirsiz", "şerefsiz", "serefsiz", "hıyar", "hiyar", "sürtük", "surtuk", "zibidi", "çulsuz",
  "culsuz", "amsk", "mala bak", "mal",

  // Leet Speak & Rakam/Sembol Karışımlı Varyasyonlar (Kaçınma Denemeleri İçin)
  "a.m.k", "a.q", "a-m-k", "a-q", "s.i.k", "s.a.l.a.k", "o.r.o.s.p.u", "p.i.ç",
  "s1k", "s1k1sh", "s1kt1r", "4mk", "4mq", "0rospu", "p1c", "y4rr4k", "g0t", "1bne",
  "p3z3v3nk", "4n4n1", "s!k", "a.m.k.", "a.q.", "o.ç.", "o.c."
];

module.exports = badWords;
