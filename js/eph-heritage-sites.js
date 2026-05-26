'use strict';

function loadPrimaryData() {
  doPreProcessing();
  populateDesignationTypesData()
    .then(() => {
      // Menjalankan pencarian BERSAMAAN (Paralel)
      return Promise.all([
        populateCoordinatesData().then(populateMapAndIndex), // Jalur 1
        populateImageAndWikipediaData(),                     // Jalur 2
        populateImportantEventsData()                        // Jalur 3: KODE BARU UNTUK PERISTIWA PENTING
      ]);
    })
    .then(enableApp);
}

// Performs pre data post-processing: mainly initialize static content
function doPreProcessing() {
  let anchorElem = document.getElementById('wdqs-link');
  anchorElem.href = 'https://query.wikidata.org/#' + encodeURIComponent(ABOUT_SPARQL_QUERY);
  processHashChange();
}

function populateDesignationTypesData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_0,
    function(result) {
      let qid = result.siteQid.value;
      if (!(qid in Records)) {
        Records[qid] = new Record(false);
      }
      let record = Records[qid];

      if ('siteLabel' in result && result.siteLabel.value) {
        record.title = result.siteLabel.value;
      } else {
        record.title = '[ERROR: No title]';
      }

      let designationQid = result.designationQid.value;
      if ('partOf' in DESIGNATION_TYPES[designationQid]) {
        designationQid = DESIGNATION_TYPES[designationQid].partOf;
      }
      if (!(designationQid in record.designations)) {
        record.designations[designationQid] = new Designation();
      }
      
    // ============================================================
      // KODE BARU: Simpan label P131 dan Gambar Daerah Administratif
      // ============================================================
      if ('p131Label' in result && result.p131Label.value) {
        record.lokasiSpesifik = result.p131Label.value;
      }

      // Tambahan untuk menyimpan nama file gambar daerahnya
      if ('p131Image' in result && result.p131Image.value) {
        record.lokasiImage = extractImageFilename(result.p131Image);
      }
      // ============================================================

      if (!record.tahunBerdiri && result.tahunBerdiriMentah && result.tahunBerdiriMentah.value) {
        record.tahunBerdiri = result.tahunBerdiriMentah.value.substring(0, 4);
      }
    },
    function() {
      populateDesignationIndex();
      SparqlValuesClause = 'VALUES ?site {' + Object.keys(Records).map(qid => `wd:${qid}`).join(' ') + '}';
      Object.values(Records).forEach(record => { record.indexTitle = record.title });
    },
  );
}
function populateCoordinatesData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_1,
    function(result) {
      let record = Records[result.siteQid.value];
      let wktBits = result.coord.value.split(/\(|\)| /);
      record.lat = parseFloat(wktBits[2]);
      record.lon = parseFloat(wktBits[1]);
    },
    function() {
      BootstrapDataIsLoaded = true;
    },
  );
}

// FUNGSI populateDesignationDetailsData() SUDAH DIHAPUS SEPENUHNYA

function populateImageAndWikipediaData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_3,
    function(result) {
      let record = Records[result.siteQid.value];
      
      // 1. GAMBAR UTAMA (Gembok dipasang kembali agar mengunci gambar pertama yang masuk)
      if ('image' in result) {
        if (!record.imageFilename) {
          record.imageFilename = extractImageFilename(result.image);
        }
      }
      
      // 2. ARTIKEL WIKIPEDIA
      if ('wikipediaUrlTitle' in result) {
        record.articleTitle = decodeURIComponent(result.wikipediaUrlTitle.value);
      }

      // 3. GAMBAR LINGKUNGAN SEKITAR (Menggunakan unshift untuk membalikkan kembali urutan baris query)
      if (!record.vicinityImages) {
        record.vicinityImages = [];
      }
      if ('vicinityImage' in result) {
        let fotoTambahan = extractImageFilename(result.vicinityImage);
        if (!record.vicinityImages.includes(fotoTambahan)) {
          // unshift akan memasukkan gambar baru ke posisi paling depan array
          record.vicinityImages.unshift(fotoTambahan);
        }
      }

      // 4. GAMBAR MASA LALU (Gembok dipasang kembali agar tidak tertimpa baris berikutnya)
      if ('pastImage' in result) {
        if (!record.pastImage) {
          record.pastImage = extractImageFilename(result.pastImage);
        }
      }
    },
  );
}

// ============================================================
// KODE BARU: Fungsi Eksekusi Peristiwa Penting (P793)
// ============================================================
function populateImportantEventsData() {
  return queryWdqsThenProcess(
    SPARQL_QUERY_4,
    function(result) {
      let record = Records[result.siteQid.value];
      
      // Jika label peristiwa ada, kita proses
      if ('eventLabel' in result && result.eventLabel.value) {
        let eventObj = {
          label: result.eventLabel.value,
          time: ''
        };

        // Logika 1: Jika menggunakan "pada waktu" (P585)
        if ('pointInTime' in result && result.pointInTime.value) {
          eventObj.time = result.pointInTime.value.substring(0, 4);
        } 
        // Logika 2: Jika menggunakan rentang waktu "bermula sejak" (P580)
        else if ('startTime' in result && result.startTime.value) {
          let start = result.startTime.value.substring(0, 4);
          let end = ('endTime' in result && result.endTime.value) ? result.endTime.value.substring(0, 4) : 'Sekarang';
          eventObj.time = `${start} – ${end}`;
        }

        // Cek duplikasi agar tidak ada baris ganda yang tercetak
        let isDuplicate = record.events.some(e => e.label === eventObj.label && e.time === eventObj.time);
        if (!isDuplicate) {
          record.events.push(eventObj);
        }
      }
    }
  );
}

function populateDesignationIndex() {
  DesignationIndex = { all: new DesignationIndexEntry };
  Object.keys(DESIGNATION_TYPES)
    .filter(qid => !('partOf' in DESIGNATION_TYPES[qid]))
    .forEach(qid => {
      DesignationIndex[qid] = new DesignationIndexEntry;
      let orgId = DESIGNATION_TYPES[qid].org;
      if (!(orgId in DesignationIndex)) DesignationIndex[orgId] = new DesignationIndexEntry;
    });

  Object.values(Records).forEach(record => {
    DesignationIndex.all.total++;
    Object.keys(record.designations).forEach(typeQid => {
      let orgId = DESIGNATION_TYPES[typeQid].org;
      DesignationIndex[typeQid].total++;
      DesignationIndex[orgId  ].total++;
    });
  });
}

function populateMapAndIndex() {
  let listIndex = document.getElementById('index-list');
  let mapMarkers = [];
  Object.entries(Records).forEach(entry => {
    let qid = entry[0], record = entry[1];
    if (!record.isCompound && record.lat && record.lon) {
      let mapMarker = L.marker(
        [record.lat, record.lon],
        { icon: L.ExtraMarkers.icon({ icon: '', markerColor : 'orange-dark' }) },
      );
      record.mapMarker = mapMarker;
      mapMarker.bindPopup(record.title, { closeButton: false });
      let popup = mapMarker.getPopup();
      popup._qid = qid;
      record.popup = popup;
      mapMarkers.push(mapMarker);
    }
    let li = document.createElement('li');
    li.innerHTML = `<a href="#${qid}">${record.indexTitle}</a>`;
    record.indexLi = li;
    listIndex.appendChild(li);
  });
  Cluster.addLayers(mapMarkers);
  populateDesignationIndexNodes();
  generateFilterSelect();
  processHashChange();
}

function populateDesignationIndexNodes() {
  Object.values(Records).forEach(record => {
    if (record.mapMarker) DesignationIndex.all.mapMarkers.push(record.mapMarker);
    DesignationIndex.all.indexLis  .push(record.indexLi);
    Object.keys(record.designations).forEach(typeQid => {
      let orgId = DESIGNATION_TYPES[typeQid].org;
      if (record.mapMarker) {
        DesignationIndex[typeQid].mapMarkers.push(record.mapMarker);
        DesignationIndex[orgId  ].mapMarkers.push(record.mapMarker);
      }
      DesignationIndex[typeQid].indexLis.push(record.indexLi);
      DesignationIndex[orgId  ].indexLis.push(record.indexLi);
    });
  });
  Object.values(DesignationIndex).forEach(indexItem => {
    indexItem.indexLis = indexItem.indexLis
      .map(li => [li, li.textContent])
      .sort((a, b) => a[1] > b[1] ? 1 : -1)
      .map(item => item[0]);
  });
}

function generateFilterSelect() {
  let select = document.querySelector('#filter select');
  select.options[0].textContent += DesignationIndex.all.total;
  let optgroup;
  Object.keys(DESIGNATION_TYPES)
    .filter(qid => !('partOf' in DESIGNATION_TYPES[qid]))
    .map(qid => [qid, DESIGNATION_TYPES[qid].order]) 
    .sort((a, b) => a[1] - b[1])
    .map(item => item[0])
    .forEach(qid => {
      let type = DESIGNATION_TYPES[qid];
      if (type.order % 100 === 1) {
        optgroup = document.createElement('optgroup');
        optgroup.label = ORGS[type.org];
        select.appendChild(optgroup);
      }
      let option = document.createElement('option');
      option.value = qid;
      option.textContent = `${type.name} – ${DesignationIndex[qid].total}`;
      optgroup.appendChild(option);
    });
  select.addEventListener('change', function() {
    let qid = select.options[select.selectedIndex].value;
    Cluster.clearLayers();
    Cluster.addLayers(DesignationIndex[qid].mapMarkers);
    Map.fitBounds(Cluster.getBounds());
    let ol = document.getElementById('index-list');
    ol.innerHTML = '';
    DesignationIndex[qid].indexLis.forEach(li => { ol.appendChild(li) });
    select.blur();
  });
}

function activateSite(qid) {
  displayRecordDetails(qid);
  let record = Records[qid];
  if (record.isCompound) {
  }
  else if (record.mapMarker) {
    Cluster.zoomToShowLayer(
      record.mapMarker,
      function() {
        Map.setView([record.lat, record.lon], Map.getZoom());
        if (!record.popup.isOpen()) record.mapMarker.openPopup();
      },
    );
  }
}

function generateRecordDetails(qid) {
  let record = Records[qid];
  let titleHtml = `<h1>${record.title}</h1>`;
  let figureHtml = generateFigure(record.imageFilename);

  // ====================================================================
  // KODE BARU: SKENARIO PINTAR UNTUK MENCETAK GAMBAR LINGKUNGAN SEKITAR
  // ====================================================================
if (record.vicinityImages && record.vicinityImages.length > 0) {
  record.vicinityImages.forEach(imgFilename => {

    // Tambahkan langsung tanpa pembungkus DIV
    figureHtml += generateFigure(imgFilename);

  });
}
  // ====================================================================

  let articleHtml;
  if (record.articleTitle) {
    articleHtml = '<div class="article main-text loading"><div class="loader"></div></div>';
  }
  else {
    articleHtml = '<div class="article main-text nodata"><p>Situs ini belum memiliki artikel Wikipedia berbahasa Indonesia.</p></div>';
  }

// ====================================================================
  // PENYUSUNAN BLOK INFORMASI (STRUKTUR HTML BARU)
  // ====================================================================
  let designationsHtml = '<h2>Informasi</h2>';

// 1. Cetak gambar daerah langsung di bawah H2 (di luar <ul>)
if (record.pastImage) {
    designationsHtml += generateFigure(record.pastImage);
  }

  // 2. Buka tag <ul> untuk daftar informasi
  designationsHtml += '<ul class="designations">';

  // 3. Looping isi informasi daerah
  Object.keys(record.designations)
    .map(qid => [qid, DESIGNATION_TYPES[qid].order]) 
    .sort((a, b) => a[1] - b[1])
    .map(item => item[0])
    .forEach(designationQid => {

      let type = DESIGNATION_TYPES[designationQid];

      // Format Tahun Berdiri
      let infoTahunHtml = '';
      if (record.tahunBerdiri) {
        infoTahunHtml = `<p>Didirikan: ${record.tahunBerdiri}</p>`;
      } else {
        infoTahunHtml = `<p>Didirikan: Data belum tersedia</p>`;
      }

      // Format Terletak di
      let teksLokasi = record.lokasiSpesifik || ORGS[type.org];
      let infoLokasiHtml = `<p>Terletak di: ${teksLokasi}</p>`;

      // Masukkan ke dalam <li> TANPA gambar lokasi (karena sudah di atas)
      designationsHtml +=
        '<li>' +
          `<h3>${type.name}</h3>` +
          '<div class="org">' +
            `<img src="img/org_logo_${type.org.toLowerCase()}.svg">` + 
          '</div>' +
          infoLokasiHtml + 
          infoTahunHtml +
        '</li>';
        
    });
    
  // 4. Tutup tag <ul>
  designationsHtml += '</ul>';
  // ====================================================================

  // ====================================================================
  // KODE BARU: CETAK HTML UNTUK PERISTIWA PENTING
  // ====================================================================
  let eventsHtml = '';
  if (record.events && record.events.length > 0) {
    eventsHtml += '<h2>Peristiwa Penting</h2><ul class="designations">';
    
    // Looping semua peristiwa yang berhasil ditangkap
    record.events.forEach(ev => {
      let timeText = ev.time ? ` (${ev.time})` : ''; // Jika ada tahun, beri tanda kurung
      eventsHtml += `<li><p><strong>${ev.label}</strong>${timeText}</p></li>`;
    });
    
    eventsHtml += '</ul>';
  }
  // ====================================================================

  let panelElem = document.createElement('div');
  
  // MASUKKAN eventsHtml KE DALAM INNER HTML
  panelElem.innerHTML =
    `<a class="main-wikidata-link" href="https://www.wikidata.org/wiki/${qid}" title="Lihat di Wikidata">` +
    '<img src="img/wikidata_tiny_logo.png" alt="[Lihat item Wikidata]" /></a>' +
    titleHtml +
    figureHtml + 
    articleHtml +
    designationsHtml + 
    eventsHtml;  // <--- VARIABEL BARU DITEMPEL DI SINI
  
  record.panelElem = panelElem;

  if (record.articleTitle) displayArticleExtract(record.articleTitle, panelElem.querySelector('.article'));
  queryOsm(qid);
}

function displayArticleExtract(title, elem) {
  loadJsonp(
    'https://id.wikipedia.org/w/api.php',
    {
      action    : 'query',
      format    : 'json',
      prop      : 'extracts',
      exintro   : 1,
      redirects : true,
      titles    : title,
    },
    function(data) {
      elem.innerHTML =
        Object.values(data.query.pages)[0].extract.match(/<p[^]+?<\/p>/g).find(text => text.length > 50) +
        '<p class="wikipedia-link">' +
          `<a href="https://id.wikipedia.org/wiki/${encodeURIComponent(title)}">` +
            '<img src="img/wikipedia_tiny_logo.png" alt="" />' +
            '<span>Baca selengkapnya di Wikipedia</span>' +
          '</a>' +
        '</p>';
      elem.classList.remove('loading');
    }
  );
}

function queryOsm(qid) {
  let xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== xhr.DONE) return;
    if (xhr.status === 200) {
      let geoJson = osmtogeojson(JSON.parse(xhr.responseText));
      if (!geoJson || geoJson.features.length === 0) return;
      let shapeLayer = L.geoJSON(
        geoJson,
        {
          style: {
            color   : '#ff3333',
            opacity : 0.7,
            fill    : true,
          },
          filter: feature => feature.geometry.type !== 'Point',
        },
      );
      Records[qid].shapeLayer = shapeLayer;
      shapeLayer.addTo(Map);

      if (window.location.hash.replace('#', '') === qid) {
        Map.fitBounds(shapeLayer.getBounds());
      }
    }
    else {
      console.log('ERROR loading from Overpass API', xhr);
    }
  };
  xhr.open(
    'GET',
    'https://overpass-api.de/api/interpreter?data=' +
    encodeURIComponent(
`[out:json][timeout:25];
(
  way     ["wikidata"="${qid}"];
  relation["wikidata"="${qid}"];
);
out body;
>;
out skel qt;`
    ),
    true,
  );
  xhr.send();
}

// ============================================================
// CLASSES
// ------------------------------------------------------------

class Designation {
  constructor() {
    this.date             = undefined;
    this.declarationData  = undefined;
    this.declarationTitle = undefined;
    this.declarationScan  = undefined;
    this.declarationText  = undefined;
    this.partOfQid        = null;
  }
}

class DesignationIndexEntry {
  constructor() {
    this.total      = 0;
    this.mapMarkers = [];
    this.indexLis   = [];
  }
}

class Record {
  constructor(isCompound) {
    this.isCompound    = isCompound;
    this.title         = undefined;
    this.imageFilename = '';
    this.articleTitle  = undefined;
    this.designations  = {};
    this.panelElem     = undefined;
    this.indexLi       = undefined;
    this.tahunBerdiri  = undefined;
    this.events        = []; // KODE BARU: Array penampung peristiwa penting
  }
}
class SimpleRecord extends Record {
  constructor() {
    super(false);
    this.lat        = undefined;
    this.lon        = undefined;
    this.mapMarker  = undefined;
    this.popup      = undefined;
    this.shapeLayer = undefined;
  }
}

class CompoundRecord extends Record {
  constructor() {
    super(true);
    this.parts = []; 
  }
}
