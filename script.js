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

        const headerLine = lines[0];
        const dataLines = lines.slice(1);

        const rawHeaders = headerLine.split('\t').filter(h => h);
        const columns = ["번호"];

        for (let i = 1; i < rawHeaders.length; i += 2) {
            const baseName = rawHeaders[i];
            const probIndicator = rawHeaders[i+1];

            if (probIndicator && probIndicator.trim().toLowerCase() === '확률') {
                columns.push(baseName);
                columns.push(`${baseName}확률`);
            } else {
                throw new Error(`헤더 형식이 'X칸 확률' 패턴과 다릅니다. 문제의 부분: '${rawHeaders[i]} ${rawHeaders[i+1]}'`);
            }
        }

        const data = [];
        for (const line of dataLines) {
            const parts = line.split('\t').filter(p => p);
            if (parts.length === 0) continue;

            const rowData = {};
            rowData["번호"] = parseInt(parts[0]);

            let colIndexInColumns = 1;
            for (let i = 1; i < parts.length; i += 2) {
                const count = parseInt(parts[i]);
                const percentage = parseFloat(parts[i + 1].replace('%', ''));

                const baseColName = columns[colIndexInColumns];
                const probColName = columns[colIndexInColumns + 1];
                
                rowData[baseColName] = count;
                rowData[probColName] = percentage;
                
                colIndexInColumns += 2;
            }
            data.push(rowData);
        }

        const probDf = {
            columns: columns,
            data: data,

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

            filterNonZero: function(columnName) {
                return this.data.filter(row => row[columnName] > 0);
            }
        };

        return probDf;
    }
    // ************ 수정된 부분 끝 ************


    // ************ 수정된 부분: get_random_number_from_column 함수 (이전과 거의 동일하지만, probDf 구조에 맞춰 동작 확인) ************
    function get_random_number_from_column(prob_df, column_name, selection_type, exclude_numbers = new Set()) {
        let eligible_numbers = [];

        // column_name이 유효하고 prob_df.columns에 포함되어 있는지 확인
        if (column_name && prob_df.columns.includes(column_name)) {
            if (selection_type === 'top') {
                // top < 2%
                eligible_numbers = prob_df.data
                    .filter(row => row[column_name] > 2) // 2% 초과
                    .map(row => row.번호);
            } else if (selection_type === 'bottom') {
                // 0.2% <= bottom <= 2.5%
                eligible_numbers = prob_df.data
                    .filter(row => row[column_name] >= 0.2 && row[column_name] <= 2.5)
                    .map(row => row.번호);
            } else if (selection_type === 'random') {
                // 0보다 큰 모든 번호 필터링
                eligible_numbers = prob_df.filterNonZero(column_name).map(row => row.번호);
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
        outputText.innerHTML = ''; // 이전 결과 지우기

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

        for (let i = 0; i < numToGenerate; i++) {
            const finalCombinationSet = new Set();
            const randomSelectedNumbers = []; // 'random' 타입으로 선택된 번호들을 저장

            const colsToProcess = {
                'top': [],
                'bottom': [],
                'random': []
            };

            for (const colNum in columnSelectionChoices) {
                const selectionType = columnSelectionChoices[colNum];
                colsToProcess[selectionType].push(parseInt(colNum));
            }

            // 'top', 'bottom', 'random' 순서로 처리
            for (const colType of ['top', 'bottom', 'random']) {
                for (const colNum of colsToProcess[colType].sort((a, b) => a - b)) {
                    if (finalCombinationSet.size >= 6) break;

                    // 새로운 probDf 구조에 맞춰 컬럼 이름은 여전히 'X칸확률'
                    const column_name = `${colNum}칸확률`; 
                    const selected_num = get_random_number_from_column(
                        probDf,
                        column_name,
                        colType,
                        finalCombinationSet
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

    // 초기 데이터 로드
    loadData();
});