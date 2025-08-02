document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generate-button');
    const outputText = document.getElementById('output-text');
    let probDf = null;

    // --- Data Loading and Parsing ---
    async function loadData() {
        try {
            const response = await fetch('lotto_data.txt');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const dataText = await response.text();
            probDf = parseAndPrepareData(dataText);
        } catch (e) {
            alert(`'lotto_data.txt' 파일을 불러오는 데 실패했습니다: ${e.message}`);
        }
    }

    // ************ 수정된 부분: parseAndPrepareData 함수 ************
    function parseAndPrepareData(dataText) {
        const lines = dataText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error("입력된 데이터가 충분하지 않습니다.");
        }

        const headerLine = lines[0]; // 예: "1칸확률 2칸확률 3칸확률 4칸확률 5칸확률 6칸확률"
        const dataLines = lines.slice(1);

        // 헤더를 공백으로 분리하여 열 이름을 직접 얻습니다.
        // 결과: ['1칸확률', '2칸확률', ..., '6칸확률']
        const columns = headerLine.split(/\s+/).filter(h => h);
        
        // 데이터 행을 처리합니다.
        const data = [];
        for (const line of dataLines) {
            const parts = line.split(/\s+/).filter(p => p);
            if (parts.length === 0) continue; // 빈 줄 건너뛰기

            const rowNum = parseInt(parts[0]); // 첫 번째 요소는 '번호'입니다.
            const rowData = { "번호": rowNum }; // 행 데이터를 위한 객체 초기화

            // 나머지 부분을 반복하여 열 값을 가져옵니다.
            // parts[0]이 '번호'이므로, 실제 데이터 열은 parts[1]부터 시작합니다.
            // columns 배열은 parts[1]부터의 부분과 일치합니다.
            for (let i = 0; i < columns.length; i++) {
                const colName = columns[i]; // 예: "1칸확률"
                const value = parseFloat(parts[i + 1].replace('%', '')); // 퍼센트 문자열을 숫자로 변환
                rowData[colName] = value;
            }
            data.push(rowData);
        }

        // pandas DataFrame과 유사한 구조를 반환하여 후속 로직에서 쉽게 접근하도록 합니다.
        const probDf = {
            columns: columns, // 열 이름 배열: ['1칸확률', '2칸확률', ...]
            data: data,       // 행 객체 배열: [{번호: 1, '1칸확률': 1.0, ...}, ...]

            // 특정 열을 기준으로 데이터를 정렬하는 헬퍼 함수
            sortValues: function(columnName, ascending = true) {
                return [...this.data].sort((a, b) => {
                    const valA = a[columnName];
                    const valB = b[columnName];
                    if (ascending) {
                        return valA - valB;
                    } else {
                        return valB - valA;
                    }
                });
            },

            // 특정 열의 값이 0보다 큰 행을 필터링하는 헬퍼 함수
            filterNonZero: function(columnName) {
                return this.data.filter(row => row[columnName] > 0);
            }
        };

        return probDf;
    }
    // ************ 수정된 부분 끝 ************


    // ************ 수정된 부분: get_random_number_from_column 함수 ************
    function get_random_number_from_column(prob_df, column_name, selection_type, exclude_numbers = new Set(), top_range = 5, bottom_range = 8) {
        let eligible_numbers = [];

        // column_name이 유효하고 prob_df.columns에 포함되어 있는지 확인
        if (column_name && prob_df.columns.includes(column_name)) {
            if (selection_type === 'top') {
                // prob_df.sortValues는 정렬된 데이터를 반환
                const sorted_prob_data = prob_df.sortValues(column_name, false); // false = 내림차순 (top)
                eligible_numbers = sorted_prob_data.slice(0, top_range).map(row => row.번호);
            } else if (selection_type === 'bottom') {
                // 0보다 큰 확률의 데이터만 필터링
                const non_zero_prob_data = prob_df.filterNonZero(column_name);
                // 필터링된 데이터를 오름차순으로 다시 정렬
                const sorted_non_zero_prob_data = [...non_zero_prob_data].sort((a, b) => a[column_name] - b[column_name]);
                eligible_numbers = sorted_non_zero_prob_data.slice(0, bottom_range).map(row => row.번호);
            } else if (selection_type === 'random') {
                // 0보다 큰 모든 번호 필터링
                const all_non_zero_numbers = prob_df.filterNonZero(column_name).map(row => row.번호);
                eligible_numbers = all_non_zero_numbers;
            }
        }

        // 이미 선택된 번호들을 제외
        const final_eligible_numbers = eligible_numbers.filter(num => !exclude_numbers.has(num));

        if (final_eligible_numbers.length === 0) {
            return null;
        }

        return final_eligible_numbers[Math.floor(Math.random() * final_eligible_numbers.length)];
    }
    // ************ 수정된 부분 끝 ************


    // --- Combination Generation Logic ---
    function generateCombinations() {
        outputText.innerHTML = ''; // Clear previous results

        const selectionCombos = document.querySelectorAll('.controls-grid select');
        const numCombinationsInput = document.getElementById('num-combinations');

        const columnSelectionChoices = {};
        for (let i = 0; i < selectionCombos.length; i++) {
            columnSelectionChoices[i + 1] = selectionCombos[i].value;
        }

        let numToGenerate;
        try {
            numToGenerate = parseInt(numCombinationsInput.value);
            if (isNaN(numToGenerate) || numToGenerate < 1 || numToGenerate > 20) {
                alert("생성할 조합 개수는 1에서 20 사이의 숫자여야 합니다.");
                return;
            }
        } catch (e) {
            alert("생성할 조합 개수를 숫자로 입력해주세요.");
            return;
        }

        // 현재 웹 앱에는 Top/Bottom 범위 설정 UI가 없으므로 하드코딩된 기본값을 사용합니다.
        // 만약 이 값을 변경하려면 HTML에 해당 입력 필드를 추가하고 여기서 값을 읽어와야 합니다.
        const defaultTopRange = 5;
        const defaultBottomRange = 8;

        for (let i = 0; i < numToGenerate; i++) {
            const finalCombinationSet = new Set();
            const randomSelectedNumbers = []; // Store numbers selected via 'random' type

            const colsToProcess = {
                'top': [],
                'bottom': [],
                'random': []
            };

            for (const colNum in columnSelectionChoices) {
                const selectionType = columnSelectionChoices[colNum];
                colsToProcess[selectionType].push(parseInt(colNum));
            }

            // Process 'top', 'bottom', 'random' in order
            for (const colType of ['top', 'bottom', 'random']) {
                for (const colNum of colsToProcess[colType].sort((a, b) => a - b)) {
                    if (finalCombinationSet.size >= 6) break;

                    const column_name = `${colNum}칸확률`;
                    const selected_num = get_random_number_from_column(
                        probDf,
                        column_name,
                        colType,
                        finalCombinationSet,
                        defaultTopRange,    // Top 범위 전달
                        defaultBottomRange  // Bottom 범위 전달
                    );

                    if (selected_num !== null) {
                        finalCombinationSet.add(selected_num);
                        if (colType === 'random') {
                            randomSelectedNumbers.push(selected_num);
                        }
                    }
                }
                if (finalCombinationSet.size >= 6) break;
            }

            let finalCombinationList = Array.from(finalCombinationSet);
            let fillMessage = "";

            if (finalCombinationList.length < 6) {
                const remainingCount = 6 - finalCombinationList.length;
                const allPossibleNumbers = new Set(Array.from({ length: 45 }, (_, i) => i + 1));
                const availableNumbersForFill = Array.from(allPossibleNumbers).filter(num => !finalCombinationSet.has(num));

                if (availableNumbersForFill.length >= remainingCount) {
                    // 랜덤으로 부족한 숫자 채우기
                    const newlyAdded = [];
                    for (let k = 0; k < remainingCount; k++) {
                        const randomIndex = Math.floor(Math.random() * availableNumbersForFill.length);
                        const num = availableNumbersForFill.splice(randomIndex, 1)[0];
                        newlyAdded.push(num);
                    }
                    finalCombinationList.push(...newlyAdded);
                    fillMessage = " (일부 숫자가 1~45 랜덤으로 채워졌습니다.)";
                } else {
                    fillMessage = " (6개 숫자를 채우지 못했습니다.)";
                }
            }

            finalCombinationList.sort((a, b) => a - b);

            const resultDiv = document.createElement('div');
            resultDiv.classList.add('combination-result');

            const combinationText = `<strong>조합 ${i + 1}:</strong> <span class="combination-numbers">[${finalCombinationList.join(', ')}]</span>${fillMessage}`;
            let randomValueText = "";
            if (randomSelectedNumbers.length > 0) {
                randomValueText = `<span class="random-value">랜덤값: ${randomSelectedNumbers.sort((a, b) => a - b).join(', ')}</span>`;
            }

            resultDiv.innerHTML = `${combinationText} ${randomValueText}`;
            outputText.appendChild(resultDiv);

            if ((i + 1) % 5 === 0 && (i + 1) < numToGenerate) {
                const spacer = document.createElement('div');
                spacer.style.height = '1em';
                outputText.appendChild(spacer);
            }
        }
    }

    generateButton.addEventListener('click', generateCombinations);

    // Initial data load
    loadData();
});