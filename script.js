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

    function parseAndPrepareData(dataText) {
        const lines = dataText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error("입력된 데이터가 충분하지 않습니다.");
        }

        const headerLine = lines[0];
        const dataLines = lines.slice(1);

        const rawHeaders = headerLine.split(/\s+/).filter(h => h);
        const parsedHeaders = [];
        for (let i = 0; i < rawHeaders.length; i += 2) {
            if (i + 1 < rawHeaders.length && rawHeaders[i + 1].trim().toLowerCase() === '확률') {
                const baseName = rawHeaders[i].trim();
                parsedHeaders.push(`${baseName}빈도`);
                parsedHeaders.push(`${baseName}확률`);
            } else {
                throw new Error(`헤더 형식이 '칸 확률' 패턴과 다릅니다. 문제의 부분: '${rawHeaders[i]} ${rawHeaders[i+1]}'`)
            }
        }

        const data = dataLines.map(line => {
            const values = line.trim().split(/\s+/);
            const row = { index: parseInt(values[0], 10) };
            for (let i = 1; i < values.length; i++) {
                row[parsedHeaders[i - 1]] = values[i];
            }
            return row;
        });

        const probabilityData = {};
        const probabilityColumns = parsedHeaders.filter(h => h.includes('확률'));

        probabilityColumns.forEach(col => {
            probabilityData[col] = {};
        });

        data.forEach(row => {
            probabilityColumns.forEach(col => {
                let value = row[col] || '0.00%';
                value = value.replace('None', '0.00%').replace('%', '').trim();
                probabilityData[col][row.index] = parseFloat(value);
            });
        });

        return probabilityData;
    }

    // --- Number Selection Function ---
    function getRandomNumberFromColumn(columnName, selectionType, excludeNumbers = new Set()) {
        if (!probDf || !probDf[columnName]) {
            return null;
        }

        const columnData = probDf[columnName];
        let eligibleNumbers = [];

        const numberProbPairs = Object.entries(columnData).map(([num, prob]) => ({ number: parseInt(num, 10), prob }));

        if (selectionType === 'top') {
            eligibleNumbers = numberProbPairs.filter(p => p.prob > 2 && !excludeNumbers.has(p.number)).map(p => p.number);
        } else if (selectionType === 'bottom') {
            eligibleNumbers = numberProbPairs.filter(p => p.prob >= 0.2 && p.prob <= 2.5 && !excludeNumbers.has(p.number)).map(p => p.number);
        } else if (selectionType === 'random') {
            eligibleNumbers = numberProbPairs.filter(p => p.prob > 0 && !excludeNumbers.has(p.number)).map(p => p.number);
        }

        if (eligibleNumbers.length === 0) {
            return null;
        }

        return eligibleNumbers[Math.floor(Math.random() * eligibleNumbers.length)];
    }

    // --- Combination Generation ---
    function generateCombinations() {
        if (!probDf) {
            alert("'lotto_data.txt'가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
            return;
        }

        outputText.innerHTML = '';
        const numToGenerate = parseInt(document.getElementById('num-combinations').value, 10);

        if (isNaN(numToGenerate) || numToGenerate < 1 || numToGenerate > 20) {
            alert("생성할 조합 개수는 1에서 20 사이여야 합니다.");
            return;
        }

        const columnSelectionChoices = {};
        for (let i = 1; i <= 6; i++) {
            columnSelectionChoices[i] = document.getElementById(`num${i}`).value;
        }

        for (let i = 0; i < numToGenerate; i++) {
            let finalCombinationSet = new Set();
            let randomSelectedNumbers = [];

            const colsToProcess = {
                'top': [],
                'bottom': [],
                'random': []
            };

            for (const colNum in columnSelectionChoices) {
                colsToProcess[columnSelectionChoices[colNum]].push(parseInt(colNum, 10));
            }

            ['top', 'bottom', 'random'].forEach(colType => {
                colsToProcess[colType].sort((a, b) => a - b).forEach(colNum => {
                    if (finalCombinationSet.size >= 6) return;
                    const columnName = `${colNum}칸확률`;
                    const selectedNum = getRandomNumberFromColumn(columnName, colType, finalCombinationSet);

                    if (selectedNum !== null) {
                        finalCombinationSet.add(selectedNum);
                        if (colType === 'random') {
                            randomSelectedNumbers.push(selectedNum);
                        }
                    }
                });
            });

            let finalCombinationList = Array.from(finalCombinationSet);
            let fillMessage = "";
            if (finalCombinationList.length < 6) {
                const remainingCount = 6 - finalCombinationList.length;
                const allPossibleNumbers = new Set(Array.from({ length: 45 }, (_, i) => i + 1));
                const availableNumbers = Array.from(allPossibleNumbers).filter(n => !finalCombinationSet.has(n));
                
                if (availableNumbers.length >= remainingCount) {
                    const newlyAdded = [];
                    for(let k=0; k<remainingCount; k++){
                        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
                        const num = availableNumbers.splice(randomIndex, 1)[0];
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
