// Declarar elementos principais no topo para acesso global
const clientesPage = document.getElementById('clientesPage');
const clientesBtn = document.getElementById('clientesBtn');
const backToMainFromClientes = document.getElementById('backToMainFromClientes');
const clientesLista = document.getElementById('clientesLista');

document.addEventListener('DOMContentLoaded', () => {
    const totalElement = document.getElementById('total');
    const grid = document.querySelector('.grid');
    const clearAllButton = document.getElementById('clearAll');
    const numGroups = 7;
    const numNotesPerGroup = 10;
    let total = 0;
    let previousValues = [];

    // Elementos do Fechamento de Caixa
    const closeCashButton = document.getElementById('closeCash');
    const cashClosingPage = document.getElementById('cashClosingPage');
    const backToMainButton = document.getElementById('backToMain');
    const cashInputs = {
        cash2: document.getElementById('cash2'),
        cash5: document.getElementById('cash5'),
        cash10: document.getElementById('cash10'),
        cash20: document.getElementById('cash20'),
        cashLarger: document.getElementById('cashLarger'),
        cashCoins: document.getElementById('cashCoins')
    };
    const separateValueInput = document.getElementById('separateValue');
    const addSeparateValueButton = document.getElementById('addSeparateValue');
    const separateValuesList = document.getElementById('separateValuesList');
    const totalCashElement = document.getElementById('totalCash');
    const totalSeparateElement = document.getElementById('totalSeparate');
    const totalSheetElement = document.getElementById('totalSheet');
    const finalTotalElement = document.getElementById('finalTotal');
    const cashStatusElement = document.getElementById('cashStatus');

    let separateValues = [];
    let separateTotal = 0;

    // --- Limpeza automática dos campos da página de fechar caixa após 10 minutos ---
    const cashPageInputIds = ['cash2', 'cash5', 'cash10', 'cash20', 'cashLarger', 'cashCoins', 'separateValue'];
    const CASH_PAGE_TIMER_KEY = 'cashPageStartTime';
    const CASH_PAGE_TIMEOUT = 10 * 60 * 1000; // 10 minutos em ms
    let cashPageTimeoutInterval = null; // Timer global para o timeout da página de fechar caixa
    let timeoutWarningShown = false; // Controle para aviso de timeout

    // --- FIREBASE CONFIG ---
    const firebaseConfig = {
        apiKey: "AIzaSyBYBfk36d30gigGsE9N1jPfaju8u42XT00",
        authDomain: "clientes-lanchonete.firebaseapp.com",
        projectId: "clientes-lanchonete",
        storageBucket: "clientes-lanchonete.firebasestorage.app",
        messagingSenderId: "282375035856",
        appId: "1:282375035856:web:024852584bf1482c59f7d5"
    };
    // Inicializa o Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // --- CLIENTES PAGE LOGIC ---
    const backToMainFromClientes = document.getElementById('backToMainFromClientes');
    const addClienteForm = document.getElementById('addClienteForm');
    const clienteNomeInput = document.getElementById('clienteNome');
    const clienteCNPJInput = document.getElementById('clienteCNPJ');

    function formatCurrency(value) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function parseInputValue(input) {
        let value = input.replace(/[^\d,]/g, '').replace(',', '.');
        let numValue = parseFloat(value);
        return !isNaN(numValue) ? numValue : null;
    }

    function updateTotal() {
        total = 0;
        for (let i = 1; i <= totalPages * CELLS_PER_PAGE; i++) {
            const value = parseFloat(localStorage.getItem(`nota${i}`)) || 0;
            total += value;
        }
        const totalElement = document.getElementById('total');
        totalElement.classList.remove('grow-total');
        void totalElement.offsetWidth;
        totalElement.textContent = formatCurrency(total);
        totalElement.classList.add('grow-total');
    }

    function savePreviousValues() {
        previousValues = [];
        for (let i = 1; i <= numGroups * numNotesPerGroup; i++) {
            const cell = grid.querySelector(`.cell:nth-child(${i})`);
            const input = cell ? cell.querySelector('input') : null;
            if (input) {
                const value = input.dataset.originalValue || '';
                if (value) {
                    previousValues.push({ index: i, value: value });
                }
            }
        }
        localStorage.setItem('previousValues', JSON.stringify(previousValues)); // Salva o estado anterior
    }

    function restorePreviousValues() {
        const storedPreviousValues = localStorage.getItem('previousValues');
        if (storedPreviousValues) {
            const values = JSON.parse(storedPreviousValues);
            values.forEach(item => {
                const cell = grid.querySelector(`.cell:nth-child(${item.index})`);
                const input = cell ? cell.querySelector('input') : null;
                if (input) {
                    const value = parseInputValue(item.value);
                    if (value !== null) {
                        input.value = formatCurrency(value);
                        localStorage.setItem(`nota${item.index}`, value);
                    } else {
                        input.value = '';
                        localStorage.removeItem(`nota${item.index}`);
                    }
                }
            });
            localStorage.removeItem('previousValues'); // Limpa o estado anterior após a restauração
            updateTotal();
        }
    }

    function clearAll() {
        savePreviousValues();
        for (let i = 1; i <= totalPages * CELLS_PER_PAGE; i++) {
            localStorage.removeItem(`nota${i}`);
            const cellInput = grid.querySelector(`.cell:nth-child(${i}) input`);
            if (cellInput) {
                cellInput.value = '';
                delete cellInput.dataset.originalValue;
            }
        }
        currentPage = 1;
        totalPages = 2;
        localStorage.removeItem('cellPage2Created');
        savePageStateVars();
        updateTotal();
        renderAddPageButton();
        setTimeout(() => {
            const grid = document.querySelector('.grid');
            const start = (currentPage - 1) * CELLS_PER_PAGE + 1;
            const inputToFocus = Array.from(grid.querySelectorAll('input'))
                .find(input => input.parentElement.querySelector('div').textContent.trim() === `NOTA ${start}`);
            if (inputToFocus) {
                inputToFocus.focus();
                localStorage.setItem('lastFocusedNotaNumber', start);
            }
        }, 50);
    }

    function findNextCell(currentCell) {
        const cells = Array.from(grid.children);
        const currentIndex = cells.indexOf(currentCell);
        const currentRow = Math.floor(currentIndex / numGroups);
        const currentColumn = currentIndex % numGroups;

        let nextIndex;

        if (currentRow < numNotesPerGroup - 1) {
            nextIndex = currentIndex + numGroups;
        } else if (currentColumn < numGroups - 1) {
            nextIndex = currentColumn + 1;
        } else {
            return null;
        }

        if (nextIndex >= cells.length) {
            return null;
        }

        return cells[nextIndex];
    }

    let currentPage = 1;
    const CELLS_PER_PAGE = numGroups * numNotesPerGroup; // 70
    let totalPages = 2; // Sempre 2 páginas

    function getFilledCellsCount(page) {
        let filled = 0;
        const start = (page - 1) * CELLS_PER_PAGE + 1;
        const end = page * CELLS_PER_PAGE;
        for (let i = start; i <= end; i++) {
            const value = localStorage.getItem(`nota${i}`);
            if (value && parseFloat(value) > 0) filled++;
        }
        return filled;
    }

    function createCells(page = 1) {
        grid.innerHTML = '';
        const start = (page - 1) * CELLS_PER_PAGE + 1;
        const end = page * CELLS_PER_PAGE;
        let lastFocusedCellInput = null;
        for (let i = 0; i < numNotesPerGroup; i++) {
            for (let j = 0; j < numGroups; j++) {
                const notaNumber = start + i + j * numNotesPerGroup;
                const cell = document.createElement('div');
                cell.className = 'cell';
                const cellLabel = document.createElement('div');
                cellLabel.textContent = `NOTA ${notaNumber}`;
                const cellInput = document.createElement('input');
                cellInput.type = 'text';
                const storedValue = localStorage.getItem(`nota${notaNumber}`);
                cellInput.value = storedValue ? formatCurrency(parseFloat(storedValue)) : '';
                cellInput.dataset.originalValue = storedValue ? storedValue : '';
                cellInput.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        let targetNotaNumber;
                        if (e.key === 'ArrowUp' && notaNumber > start) {
                            targetNotaNumber = notaNumber - 1;
                        } else if (e.key === 'ArrowDown' && notaNumber < end) {
                            targetNotaNumber = notaNumber + 1;
                        }
                        if (targetNotaNumber) {
                            const nextInput = Array.from(document.querySelectorAll('.cell input'))
                                .find(input => input.parentElement.querySelector('div').textContent.trim() === `NOTA ${targetNotaNumber}`);
                            if (nextInput) {
                                nextInput.focus();
                            }
                        }
                        return;
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = parseInputValue(cellInput.value);
                        if (value !== null) {
                            localStorage.setItem(`nota${notaNumber}`, value);
                            cellInput.value = formatCurrency(value);
                        } else {
                            cellInput.value = '';
                            localStorage.removeItem(`nota${notaNumber}`);
                        }
                        updateTotal();
                        renderAddPageButton();
                        // Foco na próxima célula SEQUENCIAL pelo número da nota
                        const nextNota = notaNumber + 1;
                        if (nextNota <= end) {
                            const nextInput = Array.from(document.querySelectorAll('.cell input'))
                                .find(input => input.parentElement.querySelector('div').textContent.trim() === `NOTA ${nextNota}`);
                            if (nextInput) {
                                if ((notaNumber - start + 1) % numNotesPerGroup === 0) {
                                    nextInput.classList.add('col-change-animate');
                                    setTimeout(() => nextInput.classList.remove('col-change-animate'), 500);
                                }
                                nextInput.focus();
                            }
                        }
                    }
                });
                cellInput.addEventListener('blur', (e) => {
                    const value = parseInputValue(e.target.value);
                    if (value !== null) {
                        e.target.value = formatCurrency(value);
                        localStorage.setItem(`nota${notaNumber}`, value);
                    } else {
                        e.target.value = '';
                        localStorage.removeItem(`nota${notaNumber}`);
                    }
                    renderAddPageButton();
                    setTimeout(() => {
                        const active = document.activeElement;
                        if (!active || !active.classList.contains('cell-input')) {
                            if (lastFocusedCellInput) {
                                lastFocusedCellInput.focus();
                            }
                        }
                    }, 0);
                });
                cellInput.addEventListener('focus', (e) => {
                    e.target.setSelectionRange(0, e.target.value.length);
                    lastFocusedCellInput = e.target;
                    localStorage.setItem('lastFocusedNotaNumber', notaNumber);
                });
                cellInput.addEventListener('input', (e) => {
                    if (e.target.value.trim() === '') {
                        localStorage.removeItem(`nota${notaNumber}`);
                        updateTotal();
                        renderAddPageButton();
                    }
                });
                cellInput.classList.add('cell-input');
                cell.appendChild(cellLabel);
                cell.appendChild(cellInput);
                grid.appendChild(cell);
            }
        }
        // Foco automático na próxima célula vazia da página atual
        for (let notaNumber = start; notaNumber <= end; notaNumber++) {
            const cellInput = Array.from(document.querySelectorAll('.cell input'))
                .find(input => input.parentElement.querySelector('div').textContent.trim() === `NOTA ${notaNumber}`);
            if (cellInput && (!cellInput.value || cellInput.value === '0,00')) {
                setTimeout(() => cellInput.focus(), 0);
                break;
            }
        }
        renderAddPageButton();
    }

    function renderPageNavigation() {
        let nav = document.getElementById('cellPageNav');
        const navContainer = document.getElementById('cellPageNavContainer');
        // Só exibe a navegação se a página principal estiver visível
        const mainPageVisible = document.querySelector('.container').style.display !== 'none';
        const clientesPageVisible = clientesPage && clientesPage.style.display === 'block';
        if (!mainPageVisible || clientesPageVisible) {
            if (nav) nav.style.display = 'none';
            return;
        }
        if (!nav) {
            nav = document.createElement('div');
            nav.id = 'cellPageNav';
            nav.style.display = 'flex';
            nav.style.justifyContent = 'flex-end';
            nav.style.gap = '8px';
            nav.style.margin = '0';
            navContainer.appendChild(nav);
        }
        nav.style.display = 'flex';
        nav.innerHTML = '';
        for (let p = 1; p <= 2; p++) {
            const btn = document.createElement('button');
            btn.textContent = `Página ${p}`;
            btn.style.padding = '4px 12px';
            btn.style.borderRadius = '6px';
            btn.style.border = '1.5px solid #09974b';
            btn.style.background = p === currentPage ? '#09974b' : '#fff';
            btn.style.color = p === currentPage ? '#fff' : '#09974b';
            btn.style.fontWeight = 'bold';
            btn.style.cursor = 'pointer';
            btn.onclick = () => {
                currentPage = p;
                localStorage.setItem('currentCellPage', currentPage);
                renderPageNavigation();
                createCells(currentPage);
            };
            nav.appendChild(btn);
        }
    }

    function renderAddPageButton() {
        let btn = document.getElementById('addCellPageBtn');
        if (btn) btn.remove();
        // Não exibe mais o botão, pois a criação é automática
    }

    // Inicialização
    // Descobrir quantas páginas já existem (com base no localStorage)
    function getMaxNotaIndex() {
        let max = 0;
        for (let i = 1; i <= 1000; i++) {
            if (localStorage.getItem(`nota${i}`) !== null) max = i;
        }
        return max;
    }
    // totalPages = Math.max(1, Math.ceil(getMaxNotaIndex() / CELLS_PER_PAGE)); // REMOVIDO para não sobrescrever o valor salvo
    renderPageNavigation();
    createCells(currentPage);
    updateTotal();
    // Foco automático na primeira célula vazia da página atual ao carregar
    (function focusFirstEmptyNota() {
        const start = (currentPage - 1) * CELLS_PER_PAGE + 1;
        const end = currentPage * CELLS_PER_PAGE;
        for (let notaNumber = start; notaNumber <= end; notaNumber++) {
            const cellInput = Array.from(document.querySelectorAll('.cell input'))
                .find(input => input.parentElement.querySelector('div').textContent.trim() === `NOTA ${notaNumber}`);
            if (cellInput && (!cellInput.value || cellInput.value === '0,00')) {
                cellInput.focus();
                return;
            }
        }
    })();

    // O botão Limpar Tudo agora exibe o modal de confirmação
    clearAllButton.addEventListener('click', () => {
        document.getElementById('confirmModal').style.display = 'flex';
    });

    // Lógica do modal de confirmação
    const confirmModal = document.getElementById('confirmModal');
    const closeModal = document.getElementById('closeModal');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    function closeConfirmModal() {
        confirmModal.style.display = 'none';
    }

    closeModal.addEventListener('click', closeConfirmModal);
    confirmNo.addEventListener('click', closeConfirmModal);
    confirmModal.addEventListener('click', function(e) {
        if (e.target === confirmModal) closeConfirmModal();
    });
    document.addEventListener('keydown', function(e) {
        if (confirmModal.style.display === 'flex' && e.key === 'Escape') closeConfirmModal();
    });
    confirmYes.addEventListener('click', function() {
        closeConfirmModal();
        clearAll();
    });

    // Adicionar evento para o botão de fechar caixa
    closeCashButton.addEventListener('click', () => {
        document.querySelector('.container').style.display = 'none';
        cashClosingPage.style.display = 'block';
        cashClosingPage.classList.add('show');
        savePageState(true); // Salva o estado ao abrir a página de fechar caixa
        updateTotals();
        renderPageNavigation(); // Atualiza navegação
    });

    // Voltar para a página principal
    backToMainButton.addEventListener('click', () => {
        cashClosingPage.style.display = 'none';
        cashClosingPage.classList.remove('show');
        document.querySelector('.container').style.display = 'block';
        savePageState(false); // Salva o estado ao voltar para a página principal
        setTimeout(() => {
            createCells(currentPage); // Garante que as células são recriadas
            setTimeout(() => {
                const grid = document.querySelector('.grid');
                const start = (currentPage - 1) * CELLS_PER_PAGE + 1;
                const end = currentPage * CELLS_PER_PAGE;
                const lastNota = parseInt(localStorage.getItem('lastFocusedNotaNumber'));
                if (!isNaN(lastNota) && lastNota >= start && lastNota <= end) {
                    const inputToFocus = Array.from(grid.querySelectorAll('input'))
                        .find(input => input.parentElement.querySelector('div').textContent.trim() === `NOTA ${lastNota}`);
                    if (inputToFocus) {
                        inputToFocus.focus();
                    }
                }
                renderPageNavigation(); // Atualiza navegação
            }, 0);
        }, 0);
    });

    // Configurar inputs de moeda
    Object.values(cashInputs).forEach((input, index, arr) => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/[^\d,]/g, '');
            if (this.value.trim() === '') {
                updateTotals({onlyCashStatus: false});
                updateTotals({onlyCashStatus: true});
                saveValues();
            }
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (index < arr.length - 1) {
                    arr[index + 1].focus();
                    arr[index + 1].select();
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (index > 0) {
                    arr[index - 1].focus();
                    arr[index - 1].select();
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const value = parseInputValue(this.value);
                if (value !== null) {
                    this.value = formatCurrency(value);
                } else {
                    this.value = '';
                }
                updateTotals({onlyCashStatus: false});
                updateTotals({onlyCashStatus: true});
                saveValues();
                if (index < arr.length - 1) {
                    arr[index + 1].focus();
                    arr[index + 1].select();
                }
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                setTimeout(() => {
                    updateTotals({onlyCashStatus: false});
                    updateTotals({onlyCashStatus: true});
                    saveValues();
                }, 0);
            }
        });
        input.addEventListener('blur', function() {
            const value = parseInputValue(this.value);
            if (value !== null) {
                this.value = formatCurrency(value);
            } else {
                this.value = '';
            }
        });
        input.addEventListener('focus', function() {
            this.select();
        });
    });

    // Configurar input de valores separados
    separateValueInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^\d,]/g, '');
        if (this.value.trim() === '') {
            updateTotals({onlyCashStatus: false});
            saveValues();
        }
    });

    separateValueInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = parseInputValue(this.value);
            if (value !== null) {
                this.value = formatCurrency(value);
            } else {
                this.value = '';
            }
            updateTotals({onlyCashStatus: false});
            saveValues();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            setTimeout(() => {
                updateTotals({onlyCashStatus: false});
                saveValues();
            }, 0);
        }
    });

    separateValueInput.addEventListener('blur', function() {
        const value = parseInputValue(this.value);
        if (value !== null) {
            this.value = formatCurrency(value);
        } else {
            this.value = '';
        }
    });

    separateValueInput.addEventListener('focus', function() {
        this.select();
    });

    // Função para calcular o total dos valores separados
    function calculateSeparateTotal() {
        const value = parseInputValue(separateValueInput.value);
        return value !== null ? value : 0;
    }

    // Função para atualizar os totais
    function updateTotals({ onlyCashStatus } = {}) {
        const cashTotal = calculateCashTotal();
        const separateTotal = calculateSeparateTotal();
        const sheetTotal = total;
        
        // Atualiza o total em cédulas
        const totalCashInputs = document.getElementById('totalCashInputs');
        if (!onlyCashStatus) {
            totalCashInputs.textContent = formatCurrency(cashTotal || 0); // Garante que nunca será NaN
        }
        
        // Verificar o status do caixa
        const targetAmount = 300;
        const difference = cashTotal - targetAmount;
        const cashStatusInputs = document.getElementById('cashStatusInputs');

        // Salva o status anterior
        const prevText = cashStatusInputs.textContent;
        const prevClass = cashStatusInputs.className;
        let newText = "";
        let newClass = "";
        if (cashTotal > 0) {
            if (Math.abs(difference) < 0.01) {
                newText = "Suprimento OK";
                newClass = "ok";
            } else if (difference > 0) {
                newText = `Retire do caixa: ${formatCurrency(difference)}`;
                newClass = "excess";
            } else {
                newText = `Adicione ao caixa: ${formatCurrency(Math.abs(difference))}`;
                newClass = "lack";
            }
        }
        // Só atualiza/anima se mudou
        if (prevText !== newText || prevClass !== newClass) {
            cashStatusInputs.textContent = newText;
            cashStatusInputs.className = newClass;
            cashStatusInputs.style.animation = 'none';
            cashStatusInputs.offsetHeight;
            cashStatusInputs.style.animation = null;
        }
        if (!onlyCashStatus) {
            // Calcular os totais finais
            const supplyTotal = Math.min(cashTotal, targetAmount); // Limita o total em suprimentos a R$ 300,00
            const excessAmount = Math.max(0, difference); // Pega apenas o valor excedente
            const finalSeparateTotal = separateTotal + excessAmount; // Adiciona o excedente ao total em espécie
            const finalTotal = supplyTotal + finalSeparateTotal + sheetTotal;

            // Atualiza os totais no resumo
            const prevFinalTotal = finalTotalElement.textContent;
            totalCashElement.textContent = formatCurrency(supplyTotal);
            totalSeparateElement.textContent = formatCurrency(finalSeparateTotal);
            totalSheetElement.textContent = formatCurrency(sheetTotal);
            finalTotalElement.textContent = formatCurrency(finalTotal);
            if (finalTotalElement.textContent !== prevFinalTotal) {
                finalTotalElement.classList.remove('pulse-final-total');
                void finalTotalElement.offsetWidth;
                finalTotalElement.classList.add('pulse-final-total');
            }

            // Mostra ou esconde o total final baseado nas condições: pelo menos um campo de cédula > 0 E valor separado > 0
            const finalTotalContainer = document.getElementById('finalTotalContainer');
            const separateValue = parseInputValue(separateValueInput.value);
            // Verifica se algum campo de cédula tem valor > 0
            const hasCash = Object.values(cashInputs).some(input => {
                const val = parseInputValue(input.value);
                return val && val > 0;
            });
            if (hasCash && separateValue !== null) {
                finalTotalContainer.style.display = 'flex';
                finalTotalContainer.classList.remove('pulse-final-total');
                void finalTotalContainer.offsetWidth; // Força reflow para reiniciar animação
                finalTotalContainer.classList.add('pulse-final-total');
            } else {
                finalTotalContainer.style.display = 'none';
                finalTotalContainer.classList.remove('pulse-final-total');
            }
        }
    }

    // Função para calcular o total em cédulas
    function calculateCashTotal() {
        let total = 0;
        const inputs = ['cash2', 'cash5', 'cash10', 'cash20', 'cashLarger', 'cashCoins'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            const value = input.value;
            if (value) {
                // Remove R$, espaços e converte vírgula para ponto
                const cleanValue = value.replace('R$', '').trim().replace('.', '').replace(',', '.');
                const numericValue = parseFloat(cleanValue);
                if (!isNaN(numericValue)) {
                    total += numericValue;
                }
            }
        });
        return total;
    }

    // Adicionar valor separado
    if (addSeparateValueButton) {
        addSeparateValueButton.addEventListener('click', () => {
            const value = parseFloat(separateValueInput.value.replace(/[^\d,]/g, '').replace(',', '.'));
            if (!isNaN(value) && value > 0) {
                separateValues.push(value);
                updateSeparateValuesList();
                separateValueInput.value = '';
                updateTotals();
            }
        });
    }

    // Função para atualizar a lista de valores separados
    function updateSeparateValuesList() {
        separateValuesList.innerHTML = '';
        separateValues.forEach((value, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                ${formatCurrency(value)}
                <button onclick="removeSeparateValue(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            separateValuesList.appendChild(li);
        });
    }

    // Função para remover valor separado
    window.removeSeparateValue = function(index) {
        separateValues.splice(index, 1);
        updateSeparateValuesList();
        updateTotals();
    };

    // Função para salvar os valores no localStorage
    function saveValues() {
        const values = {
            cash: {},
            grid: {},
            cashPage: {}
        };

        // Salva valores dos inputs de caixa
        const cashInputs = ['cash2', 'cash5', 'cash10', 'cash20', 'cashLarger', 'cashCoins', 'separateValue'];
        cashInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                values.cashPage[id] = input.value;
            }
        });

        // Salva valores da grade
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            const id = cell.id;
            const value = cell.textContent;
            if (value && value !== '0,00') {
                values.grid[id] = value;
            }
        });

        localStorage.setItem('savedValues', JSON.stringify(values));
    }

    // Função para carregar os valores do localStorage
    function loadValues() {
        const savedValues = localStorage.getItem('savedValues');
        if (savedValues) {
            const values = JSON.parse(savedValues);

            // Carrega valores dos inputs de caixa
            if (values.cashPage) {
                Object.keys(values.cashPage).forEach(id => {
                    const input = document.getElementById(id);
                    if (input && values.cashPage[id]) {
                        const num = parseInputValue(values.cashPage[id]);
                        input.value = num !== null ? formatCurrency(num) : '';
                    }
                });
            }

            // Carrega valores da grade
            if (values.grid) {
                Object.keys(values.grid).forEach(id => {
                    const cell = document.getElementById(id);
                    if (cell) {
                        cell.textContent = values.grid[id];
                    }
                });
            }

            // Atualiza os totais
            updateTotals();
        }
    }

    // Função para limpar os valores salvos
    function clearSavedValues() {
        localStorage.removeItem('savedValues');
        const cashInputs = ['cash2', 'cash5', 'cash10', 'cash20', 'cashLarger', 'cashCoins', 'separateValue'];
        cashInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.value = '';
            }
        });
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.textContent = '0,00';
        });
        updateTotals();
    }

    // Adiciona evento de input para salvar os valores
    function setupInputListeners() {
        // Listeners para células da grade (mantém)
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.addEventListener('click', () => {
                saveValues();
                updateTotals();
            });
        });
    }

    // Função para salvar o estado da página
    function savePageState(isCashPage) {
        localStorage.setItem('currentPage', isCashPage ? 'cash' : 'main');
    }

    // Função para carregar o estado da página
    function loadPageState() {
        const currentPage = localStorage.getItem('currentPage') || 'main';
        const cashPage = document.getElementById('cashClosingPage');
        const mainPage = document.querySelector('.container');
        // Garante que clientesPage está definido
        if (typeof clientesPage === 'undefined' || !clientesPage) {
            window.clientesPage = document.getElementById('clientesPage');
        }
        if (currentPage === 'cash') {
            cashPage.style.display = 'block';
            cashPage.classList.add('show');
            mainPage.style.display = 'none';
            if (clientesPage) {
                clientesPage.style.display = 'none';
                clientesPage.classList.remove('show');
            }
        } else if (currentPage === 'clientes') {
            clientesPage.style.display = 'block';
            clientesPage.classList.add('show');
            cashPage.style.display = 'none';
            cashPage.classList.remove('show');
            mainPage.style.display = 'none';
            renderClientesLista();
        } else {
            cashPage.style.display = 'none';
            cashPage.classList.remove('show');
            mainPage.style.display = 'block';
            if (clientesPage) {
                clientesPage.style.display = 'none';
                clientesPage.classList.remove('show');
            }
        }
        // Remover display:none forçado se a .container for a página visível
        if (mainPage.style.display !== 'none') {
            mainPage.style.removeProperty('display');
        }
        renderPageNavigation(); // Sempre atualiza a navegação após restaurar o estado
    }

    // Salva os valores quando alternar entre as páginas
    document.getElementById('closeCash').addEventListener('click', () => {
        saveValues();
        savePageState(true);
    });

    document.getElementById('backToMain').addEventListener('click', () => {
        saveValues();
        savePageState(false);
    });

    // Função para inicializar a página
    function initializePage() {
        // Primeiro carrega o estado da página
        loadPageState();
        // Depois carrega os valores
        loadValues();
        // Por fim, configura os listeners
        setupInputListeners();
    }

    // Inicializa a página quando tudo estiver carregado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePage);
    } else {
        initializePage();
    }

    // Adiciona um observer para monitorar mudanças na visibilidade da página de caixa
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'cashClosingPage') {
                const isVisible = mutation.target.style.display === 'block';
                savePageState(isVisible);
            }
            if (mutation.target.id === 'clientesPage') {
                const isVisible = mutation.target.style.display === 'block';
                if (isVisible) {
                    localStorage.setItem('currentPage', 'clientes');
                } else {
                    localStorage.setItem('currentPage', 'main');
                }
            }
        });
    });

    observer.observe(document.getElementById('cashClosingPage'), {
        attributes: true,
        attributeFilter: ['style']
    });
    observer.observe(clientesPage, {
        attributes: true,
        attributeFilter: ['style']
    });

    // Salva o estado da página antes de recarregar
    window.addEventListener('beforeunload', () => {
        const cashPage = document.getElementById('cashClosingPage');
        const clientesPage = document.getElementById('clientesPage');
        savePageState(cashPage.style.display === 'block');
        if (clientesPage && clientesPage.style.display === 'block') {
            localStorage.setItem('currentPage', 'clientes');
        }
    });

    // Botão de copiar total de fechamento de caixa
    const copyFinalTotalBtn = document.getElementById('copyFinalTotal');
    if (copyFinalTotalBtn) {
        copyFinalTotalBtn.addEventListener('click', function() {
            const finalTotalSpan = document.getElementById('finalTotal');
            const value = finalTotalSpan ? finalTotalSpan.textContent.trim() : '';
            if (value) {
                navigator.clipboard.writeText(value);
                // Feedback visual
                copyFinalTotalBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyFinalTotalBtn.style.background = '#e8f5e9';
                setTimeout(() => {
                    copyFinalTotalBtn.innerHTML = `<span class="copy-svg"><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 448 512\" width=\"1em\" height=\"1em\"><path d=\"M384 336l-192 0c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l140.1 0L400 115.9 400 320c0 8.8-7.2 16-16 16zM192 384l192 0c35.3 0 64-28.7 64-64l0-204.1c0-12.7-5.1-24.9-14.1-33.9L366.1 14.1c-9-9-21.2-14.1-33.9-14.1L192 0c-35.3 0-64 28.7-64 64l0 256c0 35.3 28.7 64 64 64zM64 128c-35.3 0-64 28.7-64 64L0 448c0 35.3 28.7 64 64 64l192 0c35.3 0 64-28.7 64-64l0-32-48 0 0 32c0 8.8-7.2 16-16 16L64 464c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l32 0 0-48-32 0z\"/></svg></span>`;
                    copyFinalTotalBtn.style.background = 'none';
                }, 1200);
            }
        });
    }

    function clearCashPageFields() {
        cashPageInputIds.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        // Limpa também o localStorage dos campos da página de fechar caixa
        cashPageInputIds.forEach(id => localStorage.removeItem(id));
        localStorage.removeItem(CASH_PAGE_TIMER_KEY);
        timeoutWarningShown = false;
        updateTotals && updateTotals();
    }

    function checkCashPageTimeout() {
        const startTime = localStorage.getItem(CASH_PAGE_TIMER_KEY);
        if (!startTime) return;
        
        const now = Date.now();
        const elapsed = now - parseInt(startTime, 10);
        
        if (elapsed >= CASH_PAGE_TIMEOUT) {
            clearCashPageFields();
            console.log('Campos da página de fechar caixa limpos após 10 minutos de inatividade');
        }
    }

    // Função para verificar se há dados nos campos
    function hasCashPageData() {
        return cashPageInputIds.some(id => {
            const input = document.getElementById(id);
            return input && input.value.trim() !== '';
        });
    }

    // Função para iniciar o timer quando há primeira interação
    function startCashPageTimer() {
        if (!localStorage.getItem(CASH_PAGE_TIMER_KEY) && hasCashPageData()) {
            localStorage.setItem(CASH_PAGE_TIMER_KEY, Date.now().toString());
            timeoutWarningShown = false;
        }
    }

    // Função para parar o timer quando não há dados
    function stopCashPageTimer() {
        if (!hasCashPageData()) {
            localStorage.removeItem(CASH_PAGE_TIMER_KEY);
            timeoutWarningShown = false;
        }
    }

    // Listener para inputs da página de fechar caixa
    cashPageInputIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function() {
                // Inicia timer se há dados e não existe timer
                startCashPageTimer();
                // Para timer se não há dados
                stopCashPageTimer();
                checkCashPageTimeout();
            });
        }
    });

    // Função para iniciar o timer de timeout da página de fechar caixa
    function startCashPageTimeoutInterval() {
        if (cashPageTimeoutInterval) clearInterval(cashPageTimeoutInterval);
        cashPageTimeoutInterval = setInterval(() => {
            checkCashPageTimeout();
        }, 5000); // Checa a cada 5 segundos (mais eficiente)
    }

    // Função para parar o timer
    function stopCashPageTimeoutInterval() {
        if (cashPageTimeoutInterval) {
            clearInterval(cashPageTimeoutInterval);
            cashPageTimeoutInterval = null;
        }
    }

    // Checa timeout ao abrir a página de fechar caixa e inicia/parar o timer
    if (cashClosingPage) {
        const observer = new MutationObserver(() => {
            if (cashClosingPage.style.display === 'block') {
                // Verifica se há dados existentes e inicia timer se necessário
                if (hasCashPageData() && !localStorage.getItem(CASH_PAGE_TIMER_KEY)) {
                    startCashPageTimer();
                }
                checkCashPageTimeout();
                startCashPageTimeoutInterval();
            } else {
                stopCashPageTimeoutInterval();
            }
        });
        observer.observe(cashClosingPage, { attributes: true, attributeFilter: ['style'] });
    }

    // Parar o timer ao sair da página (garantia extra)
    document.getElementById('backToMain').addEventListener('click', () => {
        stopCashPageTimeoutInterval();
    });
    window.addEventListener('beforeunload', () => {
        stopCashPageTimeoutInterval();
    });

    // Verificar dados existentes ao carregar a página
    function checkExistingCashPageData() {
        if (hasCashPageData() && !localStorage.getItem(CASH_PAGE_TIMER_KEY)) {
            startCashPageTimer();
        }
    }

    // Executar verificação inicial
    setTimeout(checkExistingCashPageData, 1000);

    function showClientesPage() {
        document.querySelector('.container').style.display = 'none';
        document.getElementById('cashClosingPage').style.display = 'none';
        clientesPage.style.display = 'block';
        clientesPage.classList.add('show');
        localStorage.setItem('currentPage', 'clientes');
        renderClientesLista();
    }
    function hideClientesPage() {
        clientesPage.style.display = 'none';
        clientesPage.classList.remove('show');
        document.querySelector('.container').style.display = 'block';
        localStorage.setItem('currentPage', 'main');
    }
    if (clientesBtn) clientesBtn.addEventListener('click', () => {
        showClientesPage();
        renderPageNavigation();
    });
    if (backToMainFromClientes) backToMainFromClientes.addEventListener('click', () => {
        hideClientesPage();
        setTimeout(() => {
            createCells(currentPage);
            setTimeout(() => {
                const grid = document.querySelector('.grid');
                const start = (currentPage - 1) * CELLS_PER_PAGE + 1;
                const end = currentPage * CELLS_PER_PAGE;
                const lastNota = parseInt(localStorage.getItem('lastFocusedNotaNumber'));
                if (!isNaN(lastNota) && lastNota >= start && lastNota <= end) {
                    const inputToFocus = Array.from(grid.querySelectorAll('input'))
                        .find(input => input.parentElement.querySelector('div').textContent.trim() === `NOTA ${lastNota}`);
                    if (inputToFocus) {
                        inputToFocus.focus();
                    }
                }
                renderPageNavigation();
            }, 0);
        }, 0);
    });

    // Firestore: CRUD de clientes
    async function getClientes() {
        if (!navigator.onLine) {
            // Se está offline, usa direto o backup
            let backup = localStorage.getItem('clientesBackup');
            if (backup) {
                try {
                    const parsed = JSON.parse(backup);
                    if (Array.isArray(parsed)) return parsed;
                } catch (err) {
                    console.error('Erro ao ler clientesBackup do localStorage:', err);
                }
            }
            return [];
        }
        try {
            const snapshot = await db.collection('clientes').orderBy('nome').get();
            const clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            localStorage.setItem('clientesBackup', JSON.stringify(clientes));
            return clientes;
        } catch (e) {
            // Se der erro mesmo online, tenta o backup
            let backup = localStorage.getItem('clientesBackup');
            if (backup) {
                try {
                    const parsed = JSON.parse(backup);
                    if (Array.isArray(parsed)) return parsed;
                } catch (err) {
                    console.error('Erro ao ler clientesBackup do localStorage:', err);
                }
            }
            return [];
        }
    }
    async function addCliente(nome, cnpj) {
        await db.collection('clientes').add({ nome, cnpj });
    }
    async function removeCliente(id) {
        await db.collection('clientes').doc(id).delete();
    }
    async function renderClientesLista() {
        clientesLista.innerHTML = '<li style="color:#888;text-align:center;">Carregando...</li>';
        let clientes = await getClientes();
        clientesLista.innerHTML = '';
        if (clientes.length === 0) {
            clientesLista.innerHTML += '<li style="color:#888;text-align:center;">Nenhum cliente cadastrado.</li>';
            return;
        }
        clientes.forEach((cliente) => {
            const li = document.createElement('li');
            li.className = 'cliente-item';
            li.innerHTML = `
                <div class="cliente-info">
                    <span class="cliente-nome"><i class='fas fa-user'></i> <span class="nome-text">${cliente.nome}</span></span>
                    <span class="cliente-cnpj"><i class='fas fa-id-card'></i> <span class="cnpj-text">${cliente.cnpj}</span></span>
                </div>
                <div class="cliente-actions" style="display:flex;align-items:center;gap:8px;">
                    <button class="cliente-edit-btn" title="Editar" data-id="${cliente.id}"><i class="fas fa-edit"></i></button>
                    <button class="cliente-remove-btn" title="Remover" data-id="${cliente.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            clientesLista.appendChild(li);
        });
        // Remover cliente
        clientesLista.querySelectorAll('.cliente-remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                openConfirmRemoveClienteModal(id);
            });
        });
        // Editar cliente
        clientesLista.querySelectorAll('.cliente-edit-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const cliente = clientes.find(c => c.id === id);
                if (cliente) openModalEditCliente(cliente);
            });
        });
        // Copiar nome ao clicar
        clientesLista.querySelectorAll('.cliente-nome').forEach(span => {
            span.addEventListener('click', function() {
                const nome = this.querySelector('.nome-text').textContent;
                navigator.clipboard.writeText(nome);
                const original = this.innerHTML;
                this.innerHTML = '<i class="fas fa-user"></i> <span style="color:#09974b;font-weight:700;">Copiado!</span>';
                setTimeout(() => { this.innerHTML = original; }, 1000);
            });
        });
        // Copiar CPF/CNPJ ao clicar
        clientesLista.querySelectorAll('.cliente-cnpj').forEach(span => {
            span.addEventListener('click', function() {
                const cnpj = this.querySelector('.cnpj-text').textContent;
                navigator.clipboard.writeText(cnpj);
                const original = this.innerHTML;
                this.innerHTML = '<i class="fas fa-id-card"></i> <span style="color:#2563eb;font-weight:700;">Copiado!</span>';
                setTimeout(() => { this.innerHTML = original; }, 1000);
            });
        });
    }
    if (addClienteForm) {
        addClienteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            let nome = clienteNomeInput.value.trim();
            const cnpj = clienteCNPJInput.value.trim();
            
            // Validação com feedback visual
            let isValid = true;
            
            if (!nome || nome.length < 3) {
                clienteNomeInput.classList.add('shake');
                clienteNomeInput.style.borderColor = '#ef4444';
                clienteNomeInput.style.background = '#fef2f2';
                isValid = false;
                setTimeout(() => clienteNomeInput.classList.remove('shake'), 600);
            }
            
            const cleanCnpj = cnpj.replace(/\D/g, '');
            if (!cnpj || cleanCnpj.length < 11) {
                clienteCNPJInput.classList.add('shake');
                clienteCNPJInput.style.borderColor = '#ef4444';
                clienteCNPJInput.style.background = '#fef2f2';
                isValid = false;
                setTimeout(() => clienteCNPJInput.classList.remove('shake'), 600);
            }
            
            if (!isValid) return;
            
            nome = nome.toUpperCase();
            
            // Adiciona loading state
            const submitBtn = addClienteForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            if (submitBtn) {
                submitBtn.classList.add('loading');
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adicionando...';
                submitBtn.disabled = true;
            }
            
            try {
                await addCliente(nome, cnpj);
                
                // Feedback de sucesso
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-check"></i> Adicionado!';
                    submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                }
                
                // Limpa campos
                clienteNomeInput.value = '';
                clienteCNPJInput.value = '';
                
                // Atualiza lista e fecha modal após delay
                setTimeout(() => {
                    renderClientesLista();
                    closeModalAddClienteFn();
                    
                    // Restaura botão
                    if (submitBtn) {
                        submitBtn.classList.remove('loading');
                        submitBtn.innerHTML = originalText;
                        submitBtn.disabled = false;
                        submitBtn.style.background = '';
                    }
                }, 800);
                
            } catch (error) {
                console.error('Erro ao adicionar cliente:', error);
                
                // Feedback de erro
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro!';
                    submitBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                }
                
                // Restaura botão após delay
                setTimeout(() => {
                    if (submitBtn) {
                        submitBtn.classList.remove('loading');
                        submitBtn.innerHTML = originalText;
                        submitBtn.disabled = false;
                        submitBtn.style.background = '';
                    }
                }, 2000);
            }
        });
        // Formatar CPF/CNPJ ao digitar
        clienteCNPJInput.addEventListener('input', function(e) {
            let v = this.value.replace(/\D/g, '');
            
            // Limita o tamanho baseado no tipo de documento
            if (v.length <= 11) {
                // CPF: máximo 11 dígitos
                if (v.length > 11) v = v.slice(0, 11);
                // Formatação CPF: XXX.XXX.XXX-XX
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else {
                // CNPJ: máximo 14 dígitos
                if (v.length > 14) v = v.slice(0, 14);
                // Formatação CNPJ: XX.XXX.XXX/XXXX-XX
                v = v.replace(/(\d{2})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1/$2');
                v = v.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
            }
            
            this.value = v;
            
            // Validação visual
            const cleanValue = v.replace(/\D/g, '');
            if (cleanValue.length >= 11) {
                this.style.borderColor = '#10b981';
                this.style.background = '#f0fdf4';
            } else if (cleanValue.length > 0) {
                this.style.borderColor = '#f59e0b';
                this.style.background = '#fffbeb';
            } else {
                this.style.borderColor = '#e5e7eb';
                this.style.background = '#fafafa';
            }
        });
        
        // Validação para o campo nome
        clienteNomeInput.addEventListener('input', function(e) {
            const value = this.value.trim();
            if (value.length >= 3) {
                this.style.borderColor = '#10b981';
                this.style.background = '#f0fdf4';
            } else if (value.length > 0) {
                this.style.borderColor = '#f59e0b';
                this.style.background = '#fffbeb';
            } else {
                this.style.borderColor = '#e5e7eb';
                this.style.background = '#fafafa';
            }
        });
    }

    // --- MODAL DE ADICIONAR CLIENTE ---
    const abrirModalClienteBtn = document.getElementById('abrirModalCliente');
    const modalAddCliente = document.getElementById('modalAddCliente');
    const closeModalAddCliente = document.getElementById('closeModalAddCliente');

    function openModalAddCliente() {
        modalAddCliente.style.display = 'flex';
        // Adiciona classe para animação de entrada
        setTimeout(() => {
            modalAddCliente.classList.add('show');
        }, 10);
        document.body.style.overflow = 'hidden';
        setTimeout(() => {
            const nomeInput = document.getElementById('clienteNome');
            if (nomeInput) nomeInput.focus();
        }, 100);
    }
    function closeModalAddClienteFn() {
        // Remove classe de entrada
        modalAddCliente.classList.remove('show');
        // Animação de saída suave
        modalAddCliente.classList.add('fade-out');
        setTimeout(() => {
            modalAddCliente.style.display = 'none';
            modalAddCliente.classList.remove('fade-out');
            document.body.style.overflow = '';
            // Limpa campos ao fechar
            const nomeInput = document.getElementById('clienteNome');
            const cnpjInput = document.getElementById('clienteCNPJ');
            if (nomeInput) nomeInput.value = '';
            if (cnpjInput) cnpjInput.value = '';
        }, 400);
    }
    if (abrirModalClienteBtn) abrirModalClienteBtn.addEventListener('click', openModalAddCliente);
    if (closeModalAddCliente) closeModalAddCliente.addEventListener('click', closeModalAddClienteFn);
    if (modalAddCliente) {
        modalAddCliente.addEventListener('click', function(e) {
            if (e.target === modalAddCliente) closeModalAddClienteFn();
        });
    }
    document.addEventListener('keydown', function(e) {
        if (modalAddCliente && modalAddCliente.style.display === 'flex' && e.key === 'Escape') closeModalAddClienteFn();
    });

    // --- MODAL DE EDITAR CLIENTE ---
    const modalEditCliente = document.getElementById('modalEditCliente');
    const closeModalEditCliente = document.getElementById('closeModalEditCliente');
    const editClienteForm = document.getElementById('editClienteForm');
    const editClienteNome = document.getElementById('editClienteNome');
    const editClienteCNPJ = document.getElementById('editClienteCNPJ');
    let clienteEditandoId = null;

    function openModalEditCliente(cliente) {
        modalEditCliente.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        editClienteNome.value = cliente.nome;
        editClienteCNPJ.value = cliente.cnpj;
        clienteEditandoId = cliente.id;
        setTimeout(() => { editClienteNome.focus(); }, 100);
    }
    function closeModalEditClienteFn() {
        // Animação de saída suave
        modalEditCliente.classList.add('fade-out');
        setTimeout(() => {
            modalEditCliente.style.display = 'none';
            modalEditCliente.classList.remove('fade-out');
            document.body.style.overflow = '';
            editClienteNome.value = '';
            editClienteCNPJ.value = '';
            clienteEditandoId = null;
        }, 320);
    }
    if (closeModalEditCliente) closeModalEditCliente.addEventListener('click', closeModalEditClienteFn);
    if (modalEditCliente) {
        modalEditCliente.addEventListener('click', function(e) {
            if (e.target === modalEditCliente) closeModalEditClienteFn();
        });
    }
    document.addEventListener('keydown', function(e) {
        if (modalEditCliente && modalEditCliente.style.display === 'flex' && e.key === 'Escape') closeModalEditClienteFn();
    });
    if (editClienteForm) {
        editClienteForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!clienteEditandoId) return;
            const nome = editClienteNome.value.trim();
            const cnpj = editClienteCNPJ.value.trim();
            if (!nome || !cnpj) return;
            // Animação de clique no botão
            const submitBtn = editClienteForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.classList.add('clicked');
                setTimeout(() => submitBtn.classList.remove('clicked'), 180);
            }
            await db.collection('clientes').doc(clienteEditandoId).update({ nome, cnpj });
            closeModalEditClienteFn();
            renderClientesLista();
        });
        
        // Formatar CPF/CNPJ ao digitar no modal de editar
        editClienteCNPJ.addEventListener('input', function(e) {
            let v = this.value.replace(/\D/g, '');
            
            // Limita o tamanho baseado no tipo de documento
            if (v.length <= 11) {
                // CPF: máximo 11 dígitos
                if (v.length > 11) v = v.slice(0, 11);
                // Formatação CPF: XXX.XXX.XXX-XX
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            } else {
                // CNPJ: máximo 14 dígitos
                if (v.length > 14) v = v.slice(0, 14);
                // Formatação CNPJ: XX.XXX.XXX/XXXX-XX
                v = v.replace(/(\d{2})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1/$2');
                v = v.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
            }
            
            this.value = v;
        });
    }

    // --- CONFIRMAÇÃO DE REMOÇÃO DE CLIENTE ---
    const confirmRemoveClienteModal = document.getElementById('confirmRemoveClienteModal');
    const closeModalRemoveCliente = document.getElementById('closeModalRemoveCliente');
    const confirmRemoveClienteYes = document.getElementById('confirmRemoveClienteYes');
    const confirmRemoveClienteNo = document.getElementById('confirmRemoveClienteNo');
    let clienteRemoverId = null;

    function openConfirmRemoveClienteModal(id) {
        clienteRemoverId = id;
        confirmRemoveClienteModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    function closeConfirmRemoveClienteModal() {
        confirmRemoveClienteModal.style.display = 'none';
        document.body.style.overflow = '';
        clienteRemoverId = null;
    }
    if (closeModalRemoveCliente) closeModalRemoveCliente.addEventListener('click', closeConfirmRemoveClienteModal);
    if (confirmRemoveClienteNo) confirmRemoveClienteNo.addEventListener('click', closeConfirmRemoveClienteModal);
    if (confirmRemoveClienteModal) {
        confirmRemoveClienteModal.addEventListener('click', function(e) {
            if (e.target === confirmRemoveClienteModal) closeConfirmRemoveClienteModal();
        });
    }
    document.addEventListener('keydown', function(e) {
        if (confirmRemoveClienteModal && confirmRemoveClienteModal.style.display === 'flex' && e.key === 'Escape') closeConfirmRemoveClienteModal();
    });
    if (confirmRemoveClienteYes) {
        confirmRemoveClienteYes.addEventListener('click', async function() {
            if (clienteRemoverId) {
                await removeCliente(clienteRemoverId);
                renderClientesLista();
            }
            closeConfirmRemoveClienteModal();
        });
    }

    // Salvar página atual e totalPages sempre que mudar de página ou criar página 2
    function savePageStateVars() {
        localStorage.setItem('currentCellPage', currentPage);
        localStorage.setItem('totalCellPages', totalPages);
    }

    // Restaurar página atual e totalPages ao carregar
    (function restorePageStateVars() {
        const savedPage = parseInt(localStorage.getItem('currentCellPage'));
        const savedTotal = parseInt(localStorage.getItem('totalCellPages'));
        const page2Created = localStorage.getItem('cellPage2Created') === 'true';
        if (!isNaN(savedPage) && savedPage > 0) currentPage = savedPage;
        if (page2Created) {
            totalPages = 2;
        } else if (!isNaN(savedTotal) && savedTotal > 0) {
            totalPages = savedTotal;
        } else {
            totalPages = Math.max(1, Math.ceil(getMaxNotaIndex() / CELLS_PER_PAGE));
        }
    })();
});
