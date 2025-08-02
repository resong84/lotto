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

        if (column_name && prob_df.columns.includes(column_name)) {
            // 디버깅: 현재 칸의 모든 번호와 확률 값 출력
            console.log(`DEBUG: Processing ${column_name} for ${selection_type} selection.`);
            prob_df.data.forEach(row => {
                // 각 번호의 실제 확률 값과 타입 출력
                console.log(`  Number: ${row.번호}, Probability: ${row[column_name]} (Type: ${typeof row[column_name]})`);
            });

            if (selection_type === 'top') {
                eligible_numbers = prob_df.data
                    .filter(row => row[column_name] > 2) // 2% 초과
                    .map(row => row.번호);
            } else if (selection_type === 'bottom') {
                eligible_numbers = prob_df.data
                    .filter(row => {
                        const prob = row[column_name];
                        // 디버깅: 각 번호가 '낮은 확률' 조건에 부합하는지 여부와 실제 비교 값 출력
                        const isEligible = prob >= 0.2 && prob <= 2.5;
                        console.log(`  Number: ${row.번호}, Prob: ${prob}%, Eligible for bottom: ${isEligible} (Comparison: ${prob} >= 0.2 && ${prob} <= 2.5)`);
                        return isEligible;
                    })
                    .map(row => row.번호);
            } else if (selection_type === 'random') {
                eligible_numbers = prob_df.filterNonZero(column_name).map(row => row.번호);
            }
        }

        // 이미 선택된 번호들을 제외
        let final_eligible_numbers = eligible_numbers.filter(num => !exclude_numbers.has(num));

        // 디버깅: 필터링 후 최종적으로 선택 가능한 번호들 출력
        console.log(`DEBUG: Final eligible numbers for ${column_name} (${selection_type}):`, final_eligible_numbers);

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

            // 1칸부터 6칸까지 순차적으로 번호 선택
            for (let colNum = 1; colNum <= 6; colNum++) {
                if (finalCombinationSet.size >= 6) break;

                const colType = columnSelectionChoices[colNum];
                const columnName = `${colNum}칸확률`;

                const selectedNum = get_random_number_from_column(
                    probDf,
                    columnName,
                    colType,
                    finalCombinationSet
                );

                if (selectedNum !== null) {
                    finalCombinationSet.add(selectedNum);
                    if (colType === 'random') {
                        randomSelectedNumbers.push(selectedNum);
                    }
                }
            }

            let finalCombinationList = Array.from(finalCombinationSet);
            finalCombinationList.sort((a, b) => a - b);

            const resultDiv = document.createElement('div');
            resultDiv.classList.add('combination-result');

            const combinationText = `<strong>조합 ${i + 1}:</strong> <span class="combination-numbers">[${finalCombinationList.join(', ')}]</span>`;

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