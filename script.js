// 장비 데이터를 저장할 전역 변수
let equipmentData = [];

/**
 * CSV 데이터를 파싱하는 함수 (정규표현식 사용 안 함)
 * 각 필드는 큰따옴표(")로 감싸져 있으며 콤마(,)로 구분됨
 * @param {string} text - CSV 파일의 텍스트 내용
 * @returns {Array<Object>} - 파싱된 객체 배열
 */
function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headerLine = lines[0].trim();
    const headers = headerLine.split(',');

    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');

        const item = {};

        headers.forEach((header, index) => {
            item[header] = values[index] !== undefined ? values[index] : "";
        });
        results.push(item);
    }
    return results;
}

/**
 * 외부 CSV 파일을 불러오고 파싱하는 비동기 함수
 */
async function loadEquipmentData() {
    try {
        const response = await fetch('equipmentData.csv');
        if (!response.ok) {
            throw new Error(`CSV 파일을 불러오는 데 실패했습니다. 상태 코드: ${response.status}`);
        }

        const csvText = await response.text();

        equipmentData = parseCSV(csvText);

        if (equipmentData.length === 0) {
            throw new Error('파싱된 데이터가 없습니다.');
        }

        init();
    } catch (error) {
        console.error('데이터 로딩 중 치명적 오류:', error);
        alert('데이터를 로드하는 중 오류가 발생했습니다. 서버 환경에서 실행 중인지 확인해 주세요.');
    }
}


let currentItem = null;
let activeFilterContext = null;

function init() {
    const sidebar = document.getElementById('sidebar');
    let currentSet = "";
    let gridContainer = null;

    equipmentData.forEach((item, index) => {
        if (item.set !== currentSet) {
            currentSet = item.set;

            const setGroup = document.createElement('div');
            setGroup.className = 'set-group';

            const header = document.createElement('div');
            header.className = 'set-header';
            header.textContent = `=== ${currentSet} ===`;
            setGroup.appendChild(header);

            gridContainer = document.createElement('div');
            gridContainer.className = 'item-grid';
            setGroup.appendChild(gridContainer);

            sidebar.appendChild(setGroup);
        }

        const row = document.createElement('div');
        row.className = 'item-row';
        row.id = `item-${index}`;
        row.title = item.name;

        // 모바일: 스크롤 오탐 방지 후 즉각 반응 (touch-action: manipulation과 조합)
        let touchMoved = false;
        row.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
        row.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
        row.addEventListener('touchend', (e) => {
            if (!touchMoved) {
                e.preventDefault();
                selectItem(index);
            }
        });
        // PC 환경 대응
        row.addEventListener('click', () => selectItem(index));

        const img = document.createElement('img');
        img.className = 'item-thumb';
        img.src = `images/${item.name}.webp`;
        img.onerror = function () { this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMyMjIiLz48L3N2Zz4='; };

        row.appendChild(img);
        gridContainer.appendChild(row);
    });

    sidebar.addEventListener('scroll', updateScrollIndicators);
    window.addEventListener('scroll', updateScrollIndicators); // 모바일 전체 스크롤 대응

    selectItem(0);
}

/**
 * 스크롤 영역 밖에 'exceed' 아이템이 있는지 감지하여 인디케이터 표시
 */
function updateScrollIndicators() {
    const sidebar = document.getElementById('sidebar');
    const topIndicator = document.getElementById('indicatorTop');
    const bottomIndicator = document.getElementById('indicatorBottom');

    if (!sidebar || !topIndicator || !bottomIndicator) return;

    const exceedRows = document.querySelectorAll('.item-row.exceed');
    let hasTop = false;
    let hasBottom = false;

    const isMobile = window.innerWidth <= 768;
    const sidebarRect = sidebar.getBoundingClientRect();

    // 모바일에서 상단 고정 패널(info-panel) 높이 감안
    const infoPanel = document.querySelector('.info-panel');
    const stickyHeight = (isMobile && infoPanel) ? infoPanel.offsetHeight : 0;

    exceedRows.forEach(row => {
        const rowRect = row.getBoundingClientRect();

        if (isMobile) {
            // 모바일: 브라우저 뷰포트(화면) 기준
            // 고정된 info-panel 아래로 사라지면 상단 감지, 화면 밖으로 사라지면 하단 감지
            if (rowRect.bottom < stickyHeight) {
                hasTop = true;
            } else if (rowRect.top > window.innerHeight) {
                hasBottom = true;
            }
        } else {
            // PC: 사이드바 내부 영역 기준
            if (rowRect.bottom < sidebarRect.top) {
                hasTop = true;
            } else if (rowRect.top > sidebarRect.bottom) {
                hasBottom = true;
            }
        }
    });

    if (hasTop) topIndicator.classList.add('active');
    else topIndicator.classList.remove('active');

    if (hasBottom) bottomIndicator.classList.add('active');
    else bottomIndicator.classList.remove('active');
}

// 2. 아이템 선택
function selectItem(index) {
    const prev = document.querySelector('.item-row.active');
    if (prev) prev.classList.remove('active');

    const current = document.getElementById(`item-${index}`);
    if (current) current.classList.add('active');

    currentItem = equipmentData[index];
    updateDetailView(currentItem);

    if (activeFilterContext) {
        syncFilterHighlight(currentItem);
    }
}

// 스탯 하이라이트 동기화 함수
function syncFilterHighlight(item) {
    document.querySelectorAll('.stat-row').forEach(row => row.classList.remove('active-filter'));

    const targetName = activeFilterContext.name;

    if (item.s1 === targetName) {
        document.getElementById('row-stat1').classList.add('active-filter');
    } else if (item.s2 === targetName) {
        document.getElementById('row-stat2').classList.add('active-filter');
    } else if (item.t === targetName) {
        document.getElementById('row-trait').classList.add('active-filter');
    }
}

function updateDetailView(item) {
    const mainImg = document.getElementById('mainImage');
    const placeholder = document.querySelector('.img-placeholder');

    mainImg.style.display = 'block';
    placeholder.style.display = 'none';
    mainImg.src = `images/${item.name}.webp`;

    document.getElementById('detailSet').textContent = item.set;
    document.getElementById('detailName').textContent = item.name;

    document.getElementById('stat1Label').textContent = item.s1;
    document.getElementById('stat1Value').textContent = item.v1;

    document.getElementById('stat2Label').textContent = item.s2 !== '-' ? item.s2 : '-';
    document.getElementById('stat2Value').textContent = item.v2;

    document.getElementById('traitLabel').textContent = item.t;
    document.getElementById('traitValue').textContent = item.tv;

    document.getElementById('detailCategory').textContent = item.category || "부품";
}

// 3. 필터링 로직
function parseValue(str) {
    if (!str || str === '-') return 0;
    return parseFloat(str.replace(/[^0-9.]/g, ''));
}

function filterByStat(statNum) {
    if (!currentItem) return;

    let targetStatName, targetStatValRaw;

    if (statNum === 1) {
        targetStatName = currentItem.s1;
        targetStatValRaw = currentItem.v1;
    } else {
        if (currentItem.s2 === '-') return;
        targetStatName = currentItem.s2;
        targetStatValRaw = currentItem.v2;
    }

    const targetVal = parseValue(targetStatValRaw);

    activeFilterContext = { name: targetStatName, value: targetVal, type: 'basic' };

    applyFilter((item) => {
        const val1 = item.s1 === targetStatName ? parseValue(item.v1) : -1;
        const val2 = item.s2 === targetStatName ? parseValue(item.v2) : -1;
        const maxVal = Math.max(val1, val2);

        return {
            match: maxVal >= targetVal,
            exceed: maxVal > targetVal
        };
    }, `${targetStatName} ${targetStatValRaw} 이상`);

    syncFilterHighlight(currentItem);
}

function filterByTrait() {
    if (!currentItem) return;

    const targetName = currentItem.t;
    const targetValRaw = currentItem.tv;
    const targetVal = parseValue(targetValRaw);

    activeFilterContext = { name: targetName, value: targetVal, type: 'trait' };

    applyFilter((item) => {
        const val = item.t === targetName ? parseValue(item.tv) : -1;
        return {
            match: val >= targetVal,
            exceed: val > targetVal
        };
    }, `${targetName} ${targetValRaw} 이상`);

    syncFilterHighlight(currentItem);
}

function applyFilter(conditionFn, msg) {
    equipmentData.forEach((item, index) => {
        const row = document.getElementById(`item-${index}`);
        const result = conditionFn(item);

        const isSameCategory = currentItem && (item.category === currentItem.category);

        row.classList.remove('dimmed', 'exceed');

        if (result.match && isSameCategory) {
            if (result.exceed) {
                row.classList.add('exceed');
            }
        } else {
            row.classList.add('dimmed');
        }
    });

    document.getElementById('filterInfoArea').style.display = 'block';
    document.getElementById('filterMsg').textContent = `필터: ${msg} (분류: ${currentItem.category})`;
    document.getElementById('resetBtn').style.display = 'block';

    // 필터 적용 후 인디케이터 초기 업데이트
    setTimeout(updateScrollIndicators, 100);
}

function resetFilter() {
    const rows = document.querySelectorAll('.item-row');
    rows.forEach(row => row.classList.remove('dimmed', 'exceed'));

    document.getElementById('filterInfoArea').style.display = 'none';
    document.getElementById('filterMsg').textContent = '';

    document.querySelectorAll('.stat-row').forEach(row => row.classList.remove('active-filter'));
    activeFilterContext = null;

    // 필터 초기화 시 인디케이터 숨김
    updateScrollIndicators();
}

window.onload = loadEquipmentData;