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
};

// 3. DESIGNATION_TYPES: Kita akali dengan ID Wikidata Kabupaten/Kota
// Ini yang akan dibaca oleh Dropdown template Anda
const DESIGNATION_TYPES = {
  Q6019: { org: 'AGM', name: 'Kabupaten Agam', order: 1 },
  Q6024: { org: 'DHM', name: 'Kabupaten Dharmasraya', order: 2 },
  Q6038: { org: 'MTW', name: 'Kabupaten Kepulauan Mentawai', order: 3 },
  Q6032: { org: 'LPK', name: 'Kabupaten Lima Puluh Kota', order: 4 },
  Q6042: { org: 'PDP', name: 'Kabupaten Padang Pariaman', order: 5 },
  Q6048: { org: 'PSM', name: 'Kabupaten Pasaman', order: 6 },
  Q6103: { org: 'PSB', name: 'Kabupaten Pasaman Barat', order: 7 },
  Q6065: { org: 'PSS', name: 'Kabupaten Pesisir Selatan', order: 8 },
  Q6055: { org: 'SJJ', name: 'Kabupaten Sijunjung', order: 9 },
  Q6058: { org: 'SLK', name: 'Kabupaten Solok', order: 10 },
  Q6083: { org: 'SLS', name: 'Kabupaten Solok Selatan', order: 11 },
  Q6093: { org: 'TND', name: 'Kabupaten Tanah Datar', order: 12 },
  Q7248: { org: 'BKT', name: 'Kota Bukittinggi', order: 13 },
  Q7253: { org: 'PDG', name: 'Kota Padang', order: 14 },
  Q7256: { org: 'PPJ', name: 'Kota Padang Panjang', order: 15 },
  Q7258: { org: 'PRM', name: 'Kota Pariaman', order: 16 },
  Q7261: { org: 'PYK', name: 'Kota Payakumbuh', order: 17 },
  Q7263: { org: 'SWL', name: 'Kota Sawahlunto', order: 18 },
  Q7266: { org: 'KSL', name: 'Kota Solok', order: 19 },
};

// 4. SPARQL_QUERY_0: Mengambil data masjid, filter wilayah, properti P131 & P571 (dengan presisi)
const SPARQL_QUERY_0 =
`SELECT ?siteQid ?siteLabel ?designationQid ?p131Label ?tahunBerdiriMentah ?tahunPresisi WHERE {
  {
    # 1. Kunci wilayahnya
    VALUES ?designation { wd:Q6019 wd:Q6024 wd:Q6038 wd:Q6032 wd:Q6042 wd:Q6048 wd:Q6103 wd:Q6065 wd:Q6055 wd:Q6058 wd:Q6083 wd:Q6093 wd:Q7248 wd:Q7253 wd:Q7256 wd:Q7258 wd:Q7261 wd:Q7263 wd:Q7266 }    
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
      
  OPTIONAL { 
    ?site p:P571 ?inceptionStmt .
    ?inceptionStmt psv:P571 ?inceptionNode .
    ?inceptionNode wikibase:timeValue ?tahunBerdiriMentah ;
                   wikibase:timePrecision ?tahunPresisi .
  }
  
  BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
  BIND (SUBSTR(STR(?designation), 32) AS ?designationQid) .
} ORDER BY ?siteLabel`;

// 5. SPARQL_QUERY_1: Hanya mengambil koordinat P625
const SPARQL_QUERY_1 =
`SELECT ?siteQid ?coord WHERE {
  <SPARQLVALUESCLAUSE>
  ?site p:P625 ?coordStatement .
  ?coordStatement ps:P625 ?coord .
  FILTER NOT EXISTS { ?coordStatement pq:P518 ?x }
  BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
}`;

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

// 7. SPARQL_QUERY_4: Mengambil Peristiwa Penting (P793) beserta Detail Waktu
const SPARQL_QUERY_4 =
`SELECT ?siteQid ?eventLabel ?pointInTime ?ptPrecision ?startTime ?stPrecision ?endTime ?etPrecision WHERE {
  <SPARQLVALUESCLAUSE>
  
  # Ambil node pernyataan peristiwa penting
  ?site p:P793 ?eventStatement .
  
  # Ambil objek peristiwanya
  ?eventStatement ps:P793 ?event .
  
  # Ambil nama peristiwanya dalam bahasa Indonesia
  ?event rdfs:label ?eventLabel . 
  FILTER(LANG(?eventLabel) = "id") .
  
  # Ambil kualifikasi waktu beserta PRESISINYA menggunakan node pqv (bukan sekadar pq)
  OPTIONAL { 
    ?eventStatement pqv:P585 ?ptNode .
    ?ptNode wikibase:timeValue ?pointInTime ;
            wikibase:timePrecision ?ptPrecision .
  }
  OPTIONAL { 
    ?eventStatement pqv:P580 ?stNode .
    ?stNode wikibase:timeValue ?startTime ;
            wikibase:timePrecision ?stPrecision .
  }
  OPTIONAL { 
    ?eventStatement pqv:P582 ?etNode .
    ?etNode wikibase:timeValue ?endTime ;
            wikibase:timePrecision ?etPrecision .
  }
  
  BIND (SUBSTR(STR(?site), 32) AS ?siteQid) .
}`;

// 8. ABOUT_SPARQL_QUERY
const ABOUT_SPARQL_QUERY = ``;

// Globals
var DesignationIndex;
var Records = {};
