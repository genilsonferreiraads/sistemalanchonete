// Formatação compartilhada pelo cadastro, edição e busca de clientes.
function cleanClientDocument(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function clientDocumentType(value) {
    const clean = cleanClientDocument(value);
    return clean.length > 11 || /[A-Z]/.test(clean) ? 'cnpj' : 'cpf';
}
function formatClientDocument(value, type) {
    const clean = cleanClientDocument(value);
    const mask = type === 'cnpj' ? 'XX.XXX.XXX/XXXX-XX' : 'XXX.XXX.XXX-XX';
    const chars = (type === 'cpf' ? clean.replace(/\D/g, '') : clean).slice(0, type === 'cpf' ? 11 : 14);
    let formatted = '', index = 0;
    for (const char of mask) {
        if (index >= chars.length) break;
        formatted += char === 'X' ? chars[index++] : char;
    }
    return formatted;
}
function isClientDocumentComplete(value, type) {
    const clean = cleanClientDocument(value);
    return type === 'cpf' ? /^\d{11}$/.test(clean) : /^[A-Z0-9]{12}\d{2}$/.test(clean);
}
function normalizeClientSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function setupClientForm(form, nameInput, documentInput) {
    const radios = [...form.querySelectorAll('input[type="radio"]')];
    const nameError = document.getElementById(nameInput.id + 'Error');
    const documentError = document.getElementById(documentInput.id + 'Error');
    const status = form.querySelector('.client-form-status');
    const getType = () => radios.find(radio => radio.checked).value;
    const dialog = form.closest('[role="dialog"]');
    dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
    function clearError(input, error) {
        input.removeAttribute('aria-invalid');
        error.textContent = '';
    }
    function updateLabels() {
        const company = getType() === 'cnpj';
        form.querySelector('[data-name-label]').textContent = company ? 'Nome da empresa / razão social' : 'Nome completo';
        form.querySelector('[data-document-label]').textContent = company ? 'CNPJ' : 'CPF';
        nameInput.placeholder = company ? 'Nome da empresa' : 'Nome do cliente';
        nameInput.autocomplete = company ? 'organization' : 'name';
        documentInput.placeholder = company ? '00.000.000/0000-00' : '000.000.000-00';
        documentInput.inputMode = company ? 'text' : 'numeric';
        clearError(documentInput, documentError);
    }
    function setType(type) {
        radios.forEach(radio => { radio.checked = radio.value === type; });
        updateLabels();
    }
    radios.forEach(radio => radio.addEventListener('change', updateLabels));
    nameInput.addEventListener('input', () => clearError(nameInput, nameError));
    nameInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            documentInput.focus();
        }
    });
    documentInput.addEventListener('input', () => {
        documentInput.value = formatClientDocument(documentInput.value, getType());
        clearError(documentInput, documentError);
    });
    documentInput.addEventListener('paste', event => {
        const pasted = event.clipboardData.getData('text');
        const clean = cleanClientDocument(pasted);
        if (clean.length === 11 || clean.length === 14) {
            event.preventDefault();
            setType(clientDocumentType(clean));
            documentInput.value = formatClientDocument(clean, getType());
        }
    });
    function validate() {
        clearError(nameInput, nameError);
        clearError(documentInput, documentError);
        let valid = true;
        if (nameInput.value.trim().length < 3) {
            nameError.textContent = getType() === 'cnpj' ? 'Informe o nome da empresa.' : 'Informe o nome completo.';
            nameInput.setAttribute('aria-invalid', 'true');
            valid = false;
        }
        if (!isClientDocumentComplete(documentInput.value, getType())) {
            documentError.textContent = getType() === 'cnpj' ? 'Informe o CNPJ completo, com 14 caracteres e os 2 números finais.' : 'Informe os 11 números do CPF.';
            documentInput.setAttribute('aria-invalid', 'true');
            valid = false;
        }
        if (!valid) form.querySelector('[aria-invalid="true"]').focus();
        return valid;
    }
    function reset() {
        form.reset();
        setType('cpf');
        clearError(nameInput, nameError);
        clearError(documentInput, documentError);
        status.textContent = '';
    }
    updateLabels();
    return { getType, setType, validate, reset, status };
}

// Uma janela externa pode interromper a edição sem concluir a nota.
function createNoteFocusGuard(grid, pageDocument = document, pageWindow = window, getReturnInput = null) {
    let interrupted = null;
    function remember(input) {
        if (!input || !grid.contains(input) || !input.classList.contains('cell-input')) return;
        interrupted = {
            input,
            value: input.value,
            start: input.selectionStart,
            end: input.selectionEnd,
            direction: input.selectionDirection
        };
    }
    function restore(input) {
        if (!interrupted || interrupted.input !== input) return false;
        const saved = interrupted;
        interrupted = null;
        // Nunca sobrescreve uma edição, limpeza ou atualização posterior.
        if (input.value === saved.value) {
            input.setSelectionRange(saved.start, saved.end, saved.direction);
        }
        return true;
    }
    pageWindow.addEventListener('blur', () => remember(pageDocument.activeElement));
    pageDocument.addEventListener('visibilitychange', () => {
        if (pageDocument.hidden) remember(pageDocument.activeElement);
        else if (getReturnInput) returnToSequence();
    });
    function returnToSequence() {
        if (pageDocument.hidden || !pageDocument.hasFocus()) return;
        const input = getReturnInput();
        if (!input) { interrupted = null; return; }
        if (interrupted?.input !== input) interrupted = null;
        if (pageDocument.activeElement !== input) input.focus({ preventScroll: true });
        restore(input);
    }
    pageWindow.addEventListener('focus', () => {
        if (getReturnInput) { returnToSequence(); return; }
        if (!interrupted) return;
        const input = interrupted.input;
        if (!input.isConnected || !input.getClientRects().length) {
            interrupted = null;
            return;
        }
        const active = pageDocument.activeElement;
        if (active === input) {
            restore(input);
        } else if (!active || active === pageDocument.body) {
            input.focus({ preventScroll: true });
            restore(input);
        } else {
            // Respeita a escolha de outro campo ou botão ao retornar.
            interrupted = null;
        }
    });
    return {
        pauseOnBlur(input) {
            if (!pageDocument.hasFocus() || pageDocument.hidden) {
                remember(input);
                return true;
            }
            interrupted = null;
            return false;
        },
        resumeOnFocus: restore
    };
}

function isFirstNotePageComplete(storage) {
    for (let number = 1; number <= 70; number++) {
        const value = storage.getItem('nota' + number);
        if (value === null || !value.trim() || !Number.isFinite(Number(value))) return false;
    }
    return true;
}

function findNextEmptyNote(grid) {
    return [...grid.querySelectorAll('.cell-input')]
        .sort((a, b) => Number(a.dataset.noteNumber) - Number(b.dataset.noteNumber))
        .find(input => !input.value.trim() || input.value === '0,00');
}

// Declarar elementos principais no topo para acesso global
const clientesPage = document.getElementById('clientesPage');
const clientesBtn = document.getElementById('clientesBtn');
const backToMainFromClientes = document.getElementById('backToMainFromClientes');
const clientesLista = document.getElementById('clientesLista');

document.addEventListener('DOMContentLoaded', () => {
    const totalElement = document.getElementById('total');
    const grid = document.querySelector('.grid');
    const customNotesPage = document.getElementById('customNotesPage');
    const noteFocusGuard = createNoteFocusGuard(grid, document, window, () => {
        if (!grid.getClientRects().length || document.body.classList.contains('printing-card-pix')) return null;
        if ([...document.querySelectorAll('.modal')].some(modal => modal.getClientRects().length)) return null;
        return findNextEmptyNote(grid);
    });
    let focusedNoteInput = null;
    function focusNextEmptyNote() {
        if (!grid.getClientRects().length) return;
        const input = findNextEmptyNote(grid);
        if (input) input.focus({ preventScroll: true });
    }
    // Clicar em uma área livre volta à digitação sem capturar botões ou modais.
    document.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.defaultPrevented || !grid.getClientRects().length) return;
        const target = event.target;
        if (target.closest('button, input, select, textarea, a, label, .modal, [role="dialog"]')) return;
        if (target !== document.body && !target.closest('.container')) return;
        event.preventDefault();
        const cell = target.closest('.cell');
        if (cell) {
            cell.querySelector('input').focus({ preventScroll: true });
        } else if (grid.contains(document.activeElement)) {
            // Mantém o campo e o cursor se uma digitação já estiver em andamento.
            return;
        } else {
            focusNextEmptyNote();
        }
    });
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
                .find(input => Number(input.dataset.noteNumber) === start);
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
        for (let i = 0; i < numNotesPerGroup; i++) {
            for (let j = 0; j < numGroups; j++) {
                const notaNumber = start + i + j * numNotesPerGroup;
                const cell = document.createElement('div');
                cell.className = 'cell';
                const cellLabel = document.createElement('div');
                cellLabel.textContent = String(notaNumber);
                const cellInput = document.createElement('input');
                cellInput.type = 'text';
                cellInput.dataset.noteNumber = notaNumber;
                cellInput.setAttribute('aria-label', `Valor da nota ${notaNumber}`);
                cellInput.inputMode = 'decimal';
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
                                .find(input => Number(input.dataset.noteNumber) === targetNotaNumber);
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
                                .find(input => Number(input.dataset.noteNumber) === nextNota);
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
                    if (noteFocusGuard.pauseOnBlur(e.target)) return;
                    const value = parseInputValue(e.target.value);
                    if (value !== null) {
                        e.target.value = formatCurrency(value);
                        localStorage.setItem(`nota${notaNumber}`, value);
                    } else {
                        e.target.value = '';
                        localStorage.removeItem(`nota${notaNumber}`);
                    }
                    updateTotal();
                    renderAddPageButton();
                });
                cellInput.addEventListener('focus', (e) => {
                    if (!noteFocusGuard.resumeOnFocus(e.target) && focusedNoteInput !== e.target) {
                        e.target.setSelectionRange(0, e.target.value.length);
                    }
                    focusedNoteInput = e.target;
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
        setTimeout(focusNextEmptyNote, 0);
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
        if (!isFirstNotePageComplete(localStorage)) {
            if (nav) nav.style.display = 'none';
            if (currentPage !== 1) {
                currentPage = 1;
                localStorage.setItem('currentCellPage', '1');
                createCells(1);
            }
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
            if (p === currentPage) btn.setAttribute('aria-current', 'page');
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
        renderPageNavigation();
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
    confirmModal.addEventListener('click', function (e) {
        if (e.target === confirmModal) closeConfirmModal();
    });
    document.addEventListener('keydown', function (e) {
        if (confirmModal.style.display === 'flex' && e.key === 'Escape') closeConfirmModal();
    });
    confirmYes.addEventListener('click', function () {
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

    // Os dois comprovantes compartilham o mesmo formato de bobina térmica.
    const receiptPageStyle = document.createElement('style');
    receiptPageStyle.media = 'print';
    document.head.appendChild(receiptPageStyle);
    const receiptPaperSelect = document.getElementById('receiptPaperWidth');
    const savedReceiptPaper = localStorage.getItem('receiptPaperWidth');
    if (savedReceiptPaper === '58' || savedReceiptPaper === '80') receiptPaperSelect.value = savedReceiptPaper;
    const receiptPaperButtons = [...document.querySelectorAll('[data-receipt-paper]')];
    function syncReceiptPaperButtons() {
        receiptPaperButtons.forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.receiptPaper === receiptPaperSelect.value));
        });
    }
    function saveReceiptPaper() {
        localStorage.setItem('receiptPaperWidth', receiptPaperSelect.value === '58' ? '58' : '80');
        syncReceiptPaperButtons();
    }
    receiptPaperSelect.addEventListener('change', saveReceiptPaper);
    receiptPaperButtons.forEach(button => button.addEventListener('click', () => {
        receiptPaperSelect.value = button.dataset.receiptPaper;
        saveReceiptPaper();
        const paperSettings = button.closest?.('details');
        if (paperSettings) paperSettings.open = false;
    }));
    syncReceiptPaperButtons();

    function printCashReceipt(amount, concept, subtitle = '', includeSummary = false) {
        document.getElementById('receiptAmount').textContent = amount;
        document.getElementById('receiptConcept').textContent = concept;
        const receiptSubtitle = document.getElementById('receiptSubtitle');
        receiptSubtitle.textContent = subtitle;
        receiptSubtitle.hidden = !subtitle;
        document.getElementById('receiptSummary').hidden = !includeSummary;
        document.getElementById('receiptSupply').textContent = includeSummary ? totalCashElement.textContent.replace(/^R\$\s*/, '') : '';
        document.getElementById('receiptSeparate').textContent = includeSummary ? totalSeparateElement.textContent.replace(/^R\$\s*/, '') : '';
        document.getElementById('receiptCardPix').textContent = includeSummary ? totalSheetElement.textContent.replace(/^R\$\s*/, '') : '';
        document.getElementById('receiptDate').textContent = new Date().toLocaleString('pt-BR');
        const paperWidth = document.getElementById('receiptPaperWidth').value === '58' ? 58 : 80;
        const baseSize = paperWidth === 58 ? 20 : 24;
        const amountSize = Math.min(baseSize, baseSize * 11 / Math.max(amount.length, 11));
        const receipt = document.getElementById('cardPixReceipt');
        receipt.style.setProperty('--receipt-width', `${paperWidth}mm`);
        receipt.style.setProperty('--receipt-amount-size', `${amountSize}pt`);
        // Mede com a mesma tipografia e largura da impressão, sem exibir na tela.
        receipt.classList.add('receipt-measuring');
        let paperHeight;
        try {
            paperHeight = NoteComposer.paperHeight(receipt.offsetHeight, paperWidth);
        } finally {
            receipt.classList.remove('receipt-measuring');
        }
        receiptPageStyle.textContent = `@page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; }
            #cardPixReceipt #receiptAmount { font-size: ${amountSize}pt; }`;
        document.body.classList.add('printing-card-pix');
        try {
            window.print();
        } catch (error) {
            document.body.classList.remove('printing-card-pix');
            receiptPageStyle.textContent = '';
            throw error;
        }
    }

    function printCardPixReceipt() {
        updateTotals();
        printCashReceipt(totalSheetElement.textContent, 'Total em cartão e Pix');
    }

    document.getElementById('printCashClosing').addEventListener('click', () => {
        updateTotals();
        if (document.getElementById('finalTotalContainer').style.display === 'none') return;
        printCashReceipt(finalTotalElement.textContent, 'TOTAL FECHAMENTO DO CAIXA', '', true);
    });

    document.getElementById('printCardPix').addEventListener('click', printCardPixReceipt);
    document.getElementById('printCardPixMain').addEventListener('click', printCardPixReceipt);

    window.addEventListener('afterprint', () => {
        document.body.classList.remove('printing-card-pix');
        receiptPageStyle.textContent = '';
    });

    // Voltar para a página principal
    const appSideMenu = document.querySelector('.app-side-menu');
    document.addEventListener('click', event => {
        if (appSideMenu.open && !appSideMenu.contains(event.target)) {
            appSideMenu.open = false;
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        if (appSideMenu.open) {
            appSideMenu.open = false;
            appSideMenu.querySelector('summary').focus();
            event.preventDefault();
            return;
        }
        if (cashClosingPage.style.display === 'block') {
            event.preventDefault();
            backToMainButton.click();
        }
    });

    backToMainButton.addEventListener('click', () => {
        cashClosingPage.style.display = 'none';
        cashClosingPage.classList.remove('show');
        document.querySelector('.container').style.display = 'block';
        savePageState(false); // Salva o estado ao voltar para a página principal
        setTimeout(() => {
            createCells(currentPage); // Garante que as células são recriadas
            setTimeout(() => {
                focusNextEmptyNote();
                renderPageNavigation(); // Atualiza navegação
            }, 0);
        }, 0);
    });

    // Atualiza a conferência ao digitar; Enter só formata e avança.
    const cashFieldList = [...Object.values(cashInputs), separateValueInput];
    const cashCountingFieldCount = Object.keys(cashInputs).length;
    function formatCashAmount(cents) {
        return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function formatCashField(input) {
        const cents = CashCalculator.parseCurrencyCents(input.value);
        if (cents !== null) input.value = formatCashAmount(cents);
        updateTotals();
        saveValues();
    }
    cashFieldList.forEach((input, index) => {
        input.addEventListener('input', () => {
            updateTotals();
            saveValues();
        });
        input.addEventListener('blur', () => formatCashField(input));
        input.addEventListener('focus', () => input.select());
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                formatCashField(input);
                if (input.getAttribute('aria-invalid') !== 'true' && index < cashCountingFieldCount - 1) {
                    cashFieldList[index + 1].focus();
                }
            } else if (event.key === 'ArrowDown' && index < cashCountingFieldCount - 1) {
                event.preventDefault();
                cashFieldList[index + 1].focus();
            } else if (event.key === 'ArrowUp' && index > 0) {
                event.preventDefault();
                cashFieldList[index - 1].focus();
            }
        });
    });

    function updateTotals() {
        const inputs = Object.values(cashInputs);
        const result = CashCalculator.calculateCashClosing({
            cashValues: inputs.map(input => input.value),
            separateValue: separateValueInput.value,
            cardPixCents: Math.round(total * 100)
        });
        const countLabel = document.getElementById('totalCashInputs');
        const status = document.getElementById('cashStatusInputs');
        const totalContainer = document.getElementById('finalTotalContainer');
        const hint = document.getElementById('cashClosingHint');
        cashFieldList.forEach((input, index) => {
            const fieldKey = index === inputs.length ? 'separate' : index;
            const invalid = !result.valid && result.invalidFields.includes(fieldKey);
            input.toggleAttribute('aria-invalid', invalid);
            if (invalid) input.setAttribute('aria-invalid', 'true');
        });
        if (!result.valid) {
            countLabel.textContent = '—';
            status.textContent = result.invalidFields.includes('overflow')
                ? 'Valor acima do limite. Confira os campos.'
                : 'Confira os valores. Use vírgula e até 2 casas decimais.';
            status.className = 'invalid';
            totalCashElement.textContent = '—';
            totalSeparateElement.textContent = '—';
            totalSheetElement.textContent = formatCurrency(total);
            finalTotalElement.textContent = '—';
            totalContainer.style.display = 'none';
            hint.hidden = false;
            hint.textContent = 'Confira os valores informados para calcular o fechamento.';
            return;
        }
        const money = cents => formatCurrency(cents / 100);
        countLabel.textContent = money(result.countedCents);
        status.className = '';
        if (!result.countedCents) status.textContent = '';
        else if (result.excessCents) {
            status.textContent = 'Retire do caixa: ' + money(result.excessCents);
            status.className = 'excess';
        } else if (result.missingCents) {
            status.textContent = 'Adicione ao caixa: ' + money(result.missingCents);
            status.className = 'lack';
        } else {
            status.textContent = 'Suprimento certo. Mantenha R$ 300,00 no caixa.';
            status.className = 'ok';
        }
        totalCashElement.textContent = money(result.supplyCents);
        totalSeparateElement.textContent = money(result.combinedSeparateCents);
        totalSheetElement.textContent = money(result.cardPixCents);
        finalTotalElement.textContent = money(result.totalCents);
        totalContainer.style.display = result.ready ? 'flex' : 'none';
        hint.hidden = result.ready;
        hint.textContent = 'Preencha a contagem e o dinheiro separado para ver o total.';
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
    window.removeSeparateValue = function (index) {
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
                        const cents = CashCalculator.parseCurrencyCents(values.cashPage[id]);
                        input.value = cents !== null ? formatCashAmount(cents) : values.cashPage[id];
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
        customNotesPage.style.display = 'none';
        // Garante que clientesPage está definido
        if (typeof clientesPage === 'undefined' || !clientesPage) {
            window.clientesPage = document.getElementById('clientesPage');
        }
        if (currentPage === 'custom-notes') {
            mainPage.style.display = 'none';
            cashPage.style.display = 'none';
            clientesPage.style.display = 'none';
            customNotesPage.style.display = 'block';
        } else if (currentPage === 'cash') {
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
            // Aguarda a inicialização dos controles antes de carregar a lista.
            setTimeout(fetchAndRenderClientes, 0);
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
        if (customNotesPage.style.display === 'block') {
            localStorage.setItem('currentPage', 'custom-notes');
            return;
        }
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
        if (customNotesPage.style.display === 'block') localStorage.setItem('currentPage', 'custom-notes');
    });

    document.getElementById('customNotesBtn').addEventListener('click', () => {
        document.querySelector('.app-side-menu').open = false;
        document.querySelector('.container').style.display = 'none';
        cashClosingPage.style.display = 'none';
        clientesPage.style.display = 'none';
        customNotesPage.style.display = 'block';
        localStorage.setItem('currentPage', 'custom-notes');
        renderPageNavigation();
        customNotesPage.dispatchEvent(new Event('custom-notes-open'));
    });
    document.getElementById('backToMainFromNotes').addEventListener('click', () => {
        customNotesPage.style.display = 'none';
        document.querySelector('.container').style.display = 'block';
        localStorage.setItem('currentPage', 'main');
        createCells(currentPage);
        renderPageNavigation();
    });

    // Confirma a cópia somente depois que a área de transferência aceita o valor.
    const copyFinalTotalBtn = document.getElementById('copyFinalTotal');
    async function copyClosingTotal() {
        const status = document.getElementById('copyTotalStatus');
        try {
            await navigator.clipboard.writeText(finalTotalElement.textContent.trim());
            status.textContent = 'Total copiado';
        } catch (error) {
            status.textContent = 'Não foi possível copiar. Tente novamente.';
        }
        setTimeout(() => { status.textContent = ''; }, 2500);
    }
    copyFinalTotalBtn.addEventListener('click', async () => {
        await copyClosingTotal();
    });
    document.getElementById('copyFinalTotalArea').addEventListener('click', async () => {
        await copyClosingTotal();
    });

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
            input.addEventListener('input', function () {
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
        document.querySelector('.app-side-menu').open = false;
        document.querySelector('.container').style.display = 'none';
        document.getElementById('cashClosingPage').style.display = 'none';
        clientesPage.style.display = 'block';
        clientesPage.classList.add('show');
        localStorage.setItem('currentPage', 'clientes');
        fetchAndRenderClientes();
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
                focusNextEmptyNote();
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
    // Função auxiliar para obter iniciais
    function getInitials(name) {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    // Search Logic
    const searchInput = document.getElementById('searchCliente');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            renderClientesLista(term);
        });
    }

    let allClientes = [];

    async function fetchAndRenderClientes() {
        clientesLista.innerHTML = '<div style="text-align:center;padding:40px;color:#888;width:100%;"><i class="fas fa-spinner fa-spin" style="font-size:2em;margin-bottom:10px;"></i><p>Carregando clientes...</p></div>';
        allClientes = await getClientes();
        renderClientesLista();
    }

    function renderClientesLista(searchTerm = searchInput.value) {
        const term = normalizeClientSearch(searchTerm);
        const documentTerm = cleanClientDocument(term);
        const clientes = allClientes.filter(cliente => !term ||
            normalizeClientSearch(cliente.nome).includes(term) ||
            (documentTerm.length > 0 && cleanClientDocument(cliente.cnpj).includes(documentTerm)));
        clientesLista.replaceChildren();
        if (!clientes.length) {
            const empty = document.createElement('li');
            empty.className = 'empty-state';
            const text = document.createElement('p');
            text.textContent = term ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.';
            empty.appendChild(text);
            clientesLista.appendChild(empty);
            return;
        }
        clientes.forEach(cliente => {
            const li = document.createElement('li');
            li.className = 'cliente-card';
            li.innerHTML = `
                <button type="button" class="client-copy-field cliente-nome" data-copy="nome">
                    <span class="client-field-value"></span><i class="far fa-copy" aria-hidden="true"></i>
                </button>
                <button type="button" class="client-copy-field cliente-cnpj" data-copy="documento">
                    <span><small class="client-document-type"></small><span class="client-field-value"></span></span><i class="far fa-copy" aria-hidden="true"></i>
                </button>
                <div class="cliente-actions">
                    <button type="button" class="action-btn edit-btn cliente-edit-btn" title="Editar cliente" aria-label="Editar cliente"><i class="fas fa-pen" aria-hidden="true"></i></button>
                    <button type="button" class="action-btn remove-btn cliente-remove-btn" title="Excluir cliente" aria-label="Excluir cliente"><i class="far fa-trash-alt" aria-hidden="true"></i></button>
                </div>`;
            const nameButton = li.querySelector('[data-copy="nome"]');
            nameButton.querySelector('.client-field-value').textContent = cliente.nome;
            nameButton.setAttribute('aria-label', 'Copiar nome: ' + cliente.nome);
            nameButton.title = 'Copiar nome';
            const documentButton = li.querySelector('[data-copy="documento"]');
            const type = clientDocumentType(cliente.cnpj);
            const documentValue = isClientDocumentComplete(cliente.cnpj, type)
                ? formatClientDocument(cliente.cnpj, type) : cliente.cnpj;
            documentButton.querySelector('.client-document-type').textContent = type.toUpperCase();
            documentButton.querySelector('.client-field-value').textContent = documentValue;
            documentButton.setAttribute('aria-label', 'Copiar ' + type.toUpperCase() + ': ' + documentValue);
            documentButton.title = 'Copiar ' + type.toUpperCase();
            nameButton.addEventListener('click', () => copyClientField(nameButton, cliente.nome, 'Nome'));
            documentButton.addEventListener('click', () => copyClientField(documentButton, documentValue, type.toUpperCase()));
            li.querySelector('.cliente-edit-btn').addEventListener('click', () => openModalEditCliente(cliente));
            li.querySelector('.cliente-remove-btn').addEventListener('click', () => openConfirmRemoveClienteModal(cliente.id));
            clientesLista.appendChild(li);
        });
    }

    let copyStatusTimeout;
    async function copyClientField(button, value, label) {
        const status = document.getElementById('clientCopyStatus');
        try {
            await navigator.clipboard.writeText(String(value));
            button.classList.add('is-copied');
            button.querySelector('i').className = 'fas fa-check';
            status.textContent = label + ' copiado.';
            setTimeout(() => {
                button.classList.remove('is-copied');
                button.querySelector('i').className = 'far fa-copy';
            }, 1500);
        } catch (error) {
            status.textContent = 'Não foi possível copiar. Tente novamente.';
        }
        clearTimeout(copyStatusTimeout);
        copyStatusTimeout = setTimeout(() => { status.textContent = ''; }, 4000);
    }

    const addClientFields = setupClientForm(addClienteForm, clienteNomeInput, clienteCNPJInput);
    if (addClienteForm) {
        addClienteForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (!addClientFields.validate()) return;
            const submitButton = addClienteForm.querySelector('button[type="submit"]');
            if (submitButton.disabled) return;
            submitButton.disabled = true;
            submitButton.textContent = 'Cadastrando…';
            addClientFields.status.textContent = '';
            try {
                await addCliente(clienteNomeInput.value.trim().toUpperCase(), formatClientDocument(clienteCNPJInput.value, addClientFields.getType()));
                closeModalAddClienteFn();
                fetchAndRenderClientes();
            } catch (error) {
                addClientFields.status.textContent = 'Não foi possível salvar. Confira a conexão e tente novamente.';
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Cadastrar cliente';
            }
        });
    }

    // --- MODAL DE ADICIONAR CLIENTE ---
    const abrirModalClienteBtn = document.getElementById('abrirModalCliente');
    const modalAddCliente = document.getElementById('modalAddCliente');
    const closeModalAddCliente = document.getElementById('closeModalAddCliente');

    function openModalAddCliente() {
        addClientFields.reset();
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
            addClientFields.reset();
            abrirModalClienteBtn.focus();
        }, 400);
    }
    if (abrirModalClienteBtn) abrirModalClienteBtn.addEventListener('click', openModalAddCliente);
    if (closeModalAddCliente) closeModalAddCliente.addEventListener('click', closeModalAddClienteFn);
    if (modalAddCliente) {
        modalAddCliente.addEventListener('click', function (e) {
            if (e.target === modalAddCliente) closeModalAddClienteFn();
        });
    }
    document.addEventListener('keydown', function (e) {
        if (modalAddCliente && modalAddCliente.style.display === 'flex' && e.key === 'Escape') closeModalAddClienteFn();
    });

    // --- MODAL DE EDITAR CLIENTE ---
    const modalEditCliente = document.getElementById('modalEditCliente');
    const closeModalEditCliente = document.getElementById('closeModalEditCliente');
    const editClienteForm = document.getElementById('editClienteForm');
    const editClienteNome = document.getElementById('editClienteNome');
    const editClienteCNPJ = document.getElementById('editClienteCNPJ');
    let clienteEditandoId = null;
    let editClienteTrigger = null;
    const editClientFields = setupClientForm(editClienteForm, editClienteNome, editClienteCNPJ);

    function openModalEditCliente(cliente) {
        editClienteTrigger = document.activeElement;
        modalEditCliente.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        editClientFields.reset();
        editClientFields.setType(clientDocumentType(cliente.cnpj));
        editClienteNome.value = cliente.nome;
        editClienteCNPJ.value = isClientDocumentComplete(cliente.cnpj, editClientFields.getType())
            ? formatClientDocument(cliente.cnpj, editClientFields.getType()) : cliente.cnpj;
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
            if (editClienteTrigger && editClienteTrigger.isConnected) editClienteTrigger.focus();
        }, 320);
    }
    if (closeModalEditCliente) closeModalEditCliente.addEventListener('click', closeModalEditClienteFn);
    if (modalEditCliente) {
        modalEditCliente.addEventListener('click', function (e) {
            if (e.target === modalEditCliente) closeModalEditClienteFn();
        });
    }
    document.addEventListener('keydown', function (e) {
        if (modalEditCliente && modalEditCliente.style.display === 'flex' && e.key === 'Escape') closeModalEditClienteFn();
    });
    if (editClienteForm) {
        editClienteForm.addEventListener('submit', async event => {
            event.preventDefault();
            if (!clienteEditandoId || !editClientFields.validate()) return;
            const submitButton = editClienteForm.querySelector('button[type="submit"]');
            if (submitButton.disabled) return;
            submitButton.disabled = true;
            submitButton.textContent = 'Salvando…';
            editClientFields.status.textContent = '';
            try {
                await db.collection('clientes').doc(clienteEditandoId).update({
                    nome: editClienteNome.value.trim(),
                    cnpj: formatClientDocument(editClienteCNPJ.value, editClientFields.getType())
                });
                closeModalEditClienteFn();
                fetchAndRenderClientes();
            } catch (error) {
                editClientFields.status.textContent = 'Não foi possível salvar. Confira a conexão e tente novamente.';
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar alterações';
            }
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
        confirmRemoveClienteModal.addEventListener('click', function (e) {
            if (e.target === confirmRemoveClienteModal) closeConfirmRemoveClienteModal();
        });
    }
    document.addEventListener('keydown', function (e) {
        if (confirmRemoveClienteModal && confirmRemoveClienteModal.style.display === 'flex' && e.key === 'Escape') closeConfirmRemoveClienteModal();
    });
    if (confirmRemoveClienteYes) {
        confirmRemoveClienteYes.addEventListener('click', async function () {
            if (clienteRemoverId) {
                await removeCliente(clienteRemoverId);
                fetchAndRenderClientes();
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
        currentPage = isFirstNotePageComplete(localStorage) && savedPage === 2 ? 2 : 1;
        totalPages = 2;
        createCells(currentPage);
        renderPageNavigation();
        updateTotal();
    })();
});
