'use strict';

// 1. UBAH JUDUL PETA
const BASE_TITLE = 'Peta Persebaran Masjid – Sumatera Barat';

// 2. ORGS: Kita akali menjadi singkatan nama daerah untuk label
const ORGS = {
AGM: 'Kabupaten Agam',
  DHM: 'Kabupaten Dharmasraya',
  MTW: 'Kabupaten Kepulauan Mentawai',
  LPK: 'Kabupaten Lima Puluh Kota',
  PDP: 'Kabupaten Padang Pariaman',
  PSM: 'Kabupaten Pasaman',
  PSB: 'Kabupaten Pasaman Barat',
  PSS: 'Kabupaten Pesisir Selatan',
  SJJ: 'Kabupaten Sijunjung',
  SLK: 'Kabupaten Solok',
  SLS: 'Kabupaten Solok Selatan',
  TND: 'Kabupaten Tanah Datar',
  BKT: 'Kota Bukittinggi',
  PDG: 'Kota Padang',
  PPJ: 'Kota Padang Panjang',
  PRM: 'Kota Pariaman',
  PYK: 'Kota Payakumbuh',
  SWL: 'Kota Sawahlunto',
  KSL: 'Kota Solok',
  // Tambahkan singkatan lain jika perlu
}

// 3. DESIGNATION_TYPES: Kita akali dengan ID Wikidata Kabupaten/Kota
// Ini yang akan dibaca oleh Dropdown template Anda
const DESIGNATION_TYPES = {
Q_AGM: { org: 'AGM', name: 'Kabupaten Agam', order: 1 },
  Q_DHM: { org: 'DHM', name: 'Kabupaten Dharmasraya', order: 2 },
  Q_MTW: { org: 'MTW', name: 'Kabupaten Kepulauan Mentawai', order: 3 },
  Q_LPK: { org: 'LPK', name: 'Kabupaten Lima Puluh Kota', order: 4 },
  Q_PDP: { org: 'PDP', name: 'Kabupaten Padang Pariaman', order: 5 },
  Q_PSM: { org: 'PSM', name: 'Kabupaten Pasaman', order: 6 },
  Q_PSB: { org: 'PSB', name: 'Kabupaten Pasaman Barat', order: 7 },
  Q_PSS: { org: 'PSS', name: 'Kabupaten Pesisir Selatan', order: 8 },
  Q_SJJ: { org: 'SJJ', name: 'Kabupaten Sijunjung', order: 9 },
  Q_SLK: { org: 'SLK', name: 'Kabupaten Solok', order: 10 },
  Q_SLS: { org: 'SLS', name: 'Kabupaten Solok Selatan', order: 11 },
  Q_TND: { org: 'TND', name: 'Kabupaten Tanah Datar', order: 12 },
  Q_BKT: { org: 'BKT', name: 'Kota Bukittinggi', order: 13 },
  Q_PDG: { org: 'PDG', name: 'Kota Padang', order: 14 },
  Q_PPJ: { org: 'PPJ', name: 'Kota Padang Panjang', order: 15 },
  Q_PRM: { org: 'PRM', name: 'Kota Pariaman', order: 16 },
  Q_PYK: { org: 'PYK', name: 'Kota Payakumbuh', order: 17 },
  Q_SWL: { org: 'SWL', name: 'Kota Sawahlunto', order: 18 },
  Q_KSL: { org: 'KSL', name: 'Kota Solok', order: 19 },
  // Tambahkan ID Kab/Kota lain di sini dan pastikan urutannya (order) diteruskan
}

// 4. SPARQL_QUERY_0: Mengambil data masjid, filter wilayah, dan properti P131
// 4. SPARQL_QUERY_0: Mengambil data masjid, filter wilayah, dan properti P131
const SPARQL_QUERY_0 =
`SELECT ?siteQid ?siteLabel ?designationQid ?p131Label ?tahunBerdiriMentah WHERE {
  {
    # 1. Kunci wilayahnya
    VALUES ?designation { wd:Q7253 wd:Q7248 wd:Q7258 }
    
    # 2. Matikan otak otomatis server
    hint:Query hint:optimizer "None" .
    
    # 3. Cari SEMUA item di wilayah tersebut DULU
    ?site wdt:P131+ ?designation .
    
    # 4. BARU saring yang berstatus Masjid
    ?site wdt:P31 wd:Q32815 . 
  }
  
  ?site rdfs:label ?siteLabel . FILTER(LANG(?siteLabel) = "id") .
  
  OPTIONAL {
    ?site wdt:P131 ?p131Lokasi .
    ?p131Lokasi rdfs:label ?p131Label .
    FILTER(LANG(?p131Label) = "id") .
  }
      
  OPTIONAL { ?site wdt:P571 ?tahunBerdiriMentah . }
  
  BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
  BIND (SUBSTR(STR(?designation), 32) AS ?designationQid) .
} ORDER BY ?siteLabel`;

// 5. SPARQL_QUERY_1: Tetap sama (Hanya mengambil koordinat P625)
const SPARQL_QUERY_1 =
`SELECT ?siteQid ?coord WHERE {
  <SPARQLVALUESCLAUSE>
  ?site p:P625 ?coordStatement .
  ?coordStatement ps:P625 ?coord .
  FILTER NOT EXISTS { ?coordStatement pq:P518 ?x }
  BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
}`;

// (CATATAN: SPARQL_QUERY_2 SUDAH KITA HAPUS SEPENUHNYA AGAR SERVER TIDAK DOWN)

// 6. SPARQL_QUERY_3: Mengambil gambar dan link Wikipedia
const SPARQL_QUERY_3 =
`SELECT ?siteQid (SAMPLE(?imgUtama) AS ?image) ?vicinityImage (SAMPLE(?imgMasaLalu) AS ?pastImage) (SAMPLE(?wikiTitle) AS ?wikipediaUrlTitle) WHERE {
  <SPARQLVALUESCLAUSE>
  
  # 1. AMBIL GAMBAR UTAMA (Murni 100%: Bukan Lingkungan & Bukan Masa Lalu)
  OPTIONAL {
    ?site p:P18 ?imageStatement .
    ?imageStatement ps:P18 ?imgUtama .
    FILTER NOT EXISTS { ?imageStatement pq:P3831 wd:Q16189205 }
    FILTER NOT EXISTS { ?imageStatement pq:P180 wd:Q192630 }
  }
  
  # 2. AMBIL GAMBAR LINGKUNGAN SEKITAR (Dibiarkan tanpa SAMPLE agar tampil semua)
  OPTIONAL {
    ?site p:P18 ?vicinityStatement .
    ?vicinityStatement ps:P18 ?vicinityImage .
    FILTER EXISTS { ?vicinityStatement pq:P3831 wd:Q16189205 }
  }

  # 3. AMBIL GAMBAR MASA LALU
  OPTIONAL {
    ?site p:P18 ?pastImgStmt .
    ?pastImgStmt ps:P18 ?imgMasaLalu .
    ?pastImgStmt pq:P180 wd:Q192630 .
  }

  # 4. ARTIKEL WIKIPEDIA
  OPTIONAL {
    ?wikipedia schema:about ?site ;
               schema:isPartOf <https://id.wikipedia.org/> .
    BIND (SUBSTR(STR(?wikipedia), 31) AS ?wikiTitle) .
  }
  
  BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
} GROUP BY ?siteQid ?vicinityImage`;

// 7. ABOUT_SPARQL_QUERY: Disesuaikan menggunakan logika wilayah
const ABOUT_SPARQL_QUERY =
`
`;

// Globals
var DesignationIndex;
var Records = {}; // Memastikan Records dideklarasikan jika template membutuhkannya
