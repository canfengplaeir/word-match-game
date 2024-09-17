

function addRow(word1 = '', word2 = '') {
    const tbody = document.getElementById('wordTableBody');
    const row = tbody.insertRow();
    row.innerHTML = `
        <td><input type="checkbox" class="row-checkbox"></td>
        <td class="input-container">
            <input type="text" value="${word1}" oninput="handleInput(this)" />
            <div class="autocomplete-items"></div>
        </td>
        <td><input type="text" value="${word2}" /></td>
        <td>
            <button class="delete-btn" onclick="deleteRow(this)">删除</button>
        </td>
    `;
    if (word1 && word2 && !userEditedWords.some(([w1, w2]) => w1 === word1 && w2 === word2)) {
        userEditedWords.push([word1, word2]);
        updateWordDatabase();
    }
}
let currentPage = 1;
const itemsPerPage =15;
let userEditedWords = [];

function renderTable() {
    const tbody = document.getElementById('wordTableBody');
    tbody.innerHTML = '';
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const wordsToShow = userEditedWords.slice(startIndex, endIndex);

    wordsToShow.forEach(([word1, word2]) => {
        addRow(word1, word2);
    });

    if (userEditedWords.length === 0) {
        addRow();
    }

    updatePagination();
}

function updatePagination() {
    const pageInfo = document.getElementById('pageInfo');
    const totalPages = Math.ceil(userEditedWords.length / itemsPerPage);
    pageInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
}

function changePage(delta) {
    const totalPages = Math.ceil(userEditedWords.length / itemsPerPage);
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    renderTable();
}

function toggleAllCheckboxes() {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    const selectAllCheckbox = document.getElementById('selectAll');
    checkboxes.forEach(checkbox => checkbox.checked = selectAllCheckbox.checked);
}

function batchDelete() {
    const rows = document.getElementById('wordTableBody').rows;
    let deletedCount = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].cells[0].getElementsByTagName('input')[0].checked) {
            const word1 = rows[i].cells[1].getElementsByTagName('input')[0].value.trim();
            const word2 = rows[i].cells[2].getElementsByTagName('input')[0].value.trim();
            userEditedWords = userEditedWords.filter(([w1, w2]) => w1 !== word1 || w2 !== word2);
            deletedCount++;
        }
    }
    document.getElementById('selectAll').checked = false;
    showMessage(`已删除 ${deletedCount} 个单词`);
    updateWordDatabase();
    renderTable();
}

function getWordsData() {
    return wordDatabase;
}

function saveJSON() {
    const words = getWordsData();
    const jsonContent = JSON.stringify(words, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'words.json';
    link.click();
    showMessage('JSON 文件已保存');
}

function saveTXT() {
    const words = getWordsData();
    let txtContent = '';
    for (let word1 in words) {
        txtContent += `${word1}\n${words[word1]}\n`;
    }
    const blob = new Blob([txtContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'words.txt';
    link.click();
    showMessage('TXT 文件已保存');
}

function loadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function (event) {
            const content = event.target.result;
            if (file.name.endsWith('.json')) {
                loadJSON(content);
            } else if (file.name.endsWith('.txt')) {
                loadTXT(content);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function loadJSON(content) {
    try {
        wordDatabase = JSON.parse(content);
        userEditedWords = Object.entries(wordDatabase);
        currentPage = 1;
        renderTable();
        showMessage('JSON 文件已加载');
    } catch (e) {
        showMessage('错误：无效的 JSON 格式', 'error');
    }
}

function loadTXT(content) {
    const lines = content.split('\n');
    wordDatabase = {};
    userEditedWords = [];
    for (let i = 0; i < lines.length; i += 2) {
        const word1 = lines[i].trim();
        const word2 = lines[i + 1] ? lines[i + 1].trim() : '';
        if (word1 && word2) {
            wordDatabase[word1] = word2;
            userEditedWords.push([word1, word2]);
        }
    }
    currentPage = 1;
    renderTable();
    showMessage('TXT 文件已加载');
}
function showMessage(msg, type = 'success') {
    iziToast[type]({
        title: type === 'success' ? '成功' : '错误',
        message: msg,
        position: 'topRight',
        timeout: 3000
    });
}

function openBatchAddModal() {
    document.getElementById('batchAddModal').style.display = 'block';
}

function closeBatchAddModal() {
    document.getElementById('batchAddModal').style.display = 'none';
}

function processBatchInput() {
    const input = document.getElementById('batchInput').value;
    const lines = input.split('\n');
    let addedCount = 0;

    for (let i = 0; i < lines.length; i += 2) {
        const word1 = lines[i].trim();
        const word2 = lines[i + 1] ? lines[i + 1].trim() : '';

        if (word1 && word2) {
            addRow(word1, word2);
            addedCount++;
        }
    }

    closeBatchAddModal();
    showMessage(`已添加 ${addedCount} 个单词对`);
    document.getElementById('batchInput').value = ''; // 清空输入框
}

// 当用户点击模态框外部时关闭模态框
window.onclick = function (event) {
    if (event.target == document.getElementById('batchAddModal')) {
        closeBatchAddModal();
    }
}

let wordDatabase = {}; // 本地词库

function loadLocalDictionaries() {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;
    input.onchange = e => {
        const files = e.target.files;
        let loadedFiles = 0;
        let totalWords = 0;
        for (let file of files) {
            if (file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    try {
                        const data = JSON.parse(event.target.result);
                        Object.assign(wordDatabase, data);
                        totalWords += Object.keys(data).length;
                    } catch (error) {
                        console.error('解析文件失败:', file.name, error);
                    }
                    loadedFiles++;
                    if (loadedFiles === files.length) {
                        showMessage(`已加载 ${totalWords} 个单词`);
                        currentPage = 1;
                        renderTable();
                    }
                };
                reader.readAsText(file);
            }
        }
    };
    input.click();

}

let currentFocus = -1;

function handleInput(input) {
    const val = input.value.toLowerCase();
    const autocompleteItems = input.parentNode.querySelector('.autocomplete-items');
    autocompleteItems.innerHTML = '';
    currentFocus = -1;

    if (!val) {
        autocompleteItems.style.display = 'none';
        return;
    }

    const matches = Object.keys(wordDatabase).filter(word =>
        word.toLowerCase().startsWith(val)
    );

    if (matches.length > 0) {
        autocompleteItems.style.display = 'block';
        matches.forEach((match, index) => {
            const div = document.createElement('div');
            div.innerHTML = `
                <span class="english"><strong>${match.substr(0, val.length)}</strong>${match.substr(val.length)}</span>
                <span class="chinese">${wordDatabase[match]}</span>
            `;
            div.addEventListener('click', function () {
                selectItem(input, match);
            });
            div.setAttribute('data-index', index);
            autocompleteItems.appendChild(div);
        });
    } else {
        autocompleteItems.style.display = 'none';
    }
}

function selectItem(input, value) {
    input.value = value;
    input.parentNode.nextElementSibling.querySelector('input').value = wordDatabase[value];
    const autocompleteItems = input.parentNode.querySelector('.autocomplete-items');
    autocompleteItems.innerHTML = '';
    autocompleteItems.style.display = 'none';
}

function addActive(autocompleteItems) {
    if (!autocompleteItems) return false;
    removeActive(autocompleteItems);
    if (currentFocus >= autocompleteItems.children.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (autocompleteItems.children.length - 1);
    autocompleteItems.children[currentFocus].classList.add("autocomplete-active");

    // 确保当前选中项可见
    autocompleteItems.children[currentFocus].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start'
    });
}

function removeActive(autocompleteItems) {
    for (let i = 0; i < autocompleteItems.children.length; i++) {
        autocompleteItems.children[i].classList.remove("autocomplete-active");
    }
}

document.addEventListener("keydown", function (e) {
    const activeInput = document.activeElement;
    if (!activeInput || !activeInput.closest('.input-container')) return;

    const autocompleteItems = activeInput.closest('.input-container').querySelector('.autocomplete-items');
    if (!autocompleteItems || autocompleteItems.style.display === 'none') return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            currentFocus++;
            addActive(autocompleteItems);
            break;
        case 'ArrowUp':
            e.preventDefault();
            currentFocus--;
            addActive(autocompleteItems);
            break;
        case 'ArrowLeft':
        case 'ArrowRight':
            break;
        case 'Tab':
        case 'Enter':
            e.preventDefault();
            if (currentFocus > -1 && autocompleteItems.children[currentFocus]) {
                autocompleteItems.children[currentFocus].click();
            }
            break;
        case 'Escape':
            autocompleteItems.style.display = 'none';
            currentFocus = -1;
            break;
    }
});

document.addEventListener('click', function (e) {
    const autocompleteItems = document.querySelectorAll('.autocomplete-items');
    autocompleteItems.forEach(item => {
        if (e.target !== item && !item.contains(e.target)) {
            item.style.display = 'none';
        }
    });
});

// 初始化添加一个空行

// 初始化 iziToast
iziToast.settings({
    timeout: 3000,
    resetOnHover: true,
    transitionIn: 'flipInX',
    transitionOut: 'flipOutX',
});

function loadDictionaryList() {
    fetch('/api/dictionary-list')
        .then(response => response.json())
        .then(files => {
            loadDictionaries(files);
        })
        .catch(error => {
            console.error('加载词库列表失败:', error);
            showMessage('加载词库列表失败', 'error');
        });
}

function loadDictionaries(files) {
    let loadedCount = 0;
    let totalWords = 0;
    files.forEach(file => {
        fetch(`/api/dictionary/${file}`)
            .then(response => response.json())
            .then(data => {
                Object.assign(wordDatabase, data);
                totalWords += Object.keys(data).length;
                loadedCount++;
                if (loadedCount === files.length) {
                    showMessage(`已加载 ${totalWords} 个单词到智能提示词库`);
                }
            })
            .catch(error => {
                console.error('加载词库文件失败:', file, error);
                showMessage(`加载词库文件失败: ${file}`, 'error');
            });
    });
}

// 页面加载完成后自动加载词库
window.addEventListener('load', function () {
    loadDictionaryList(); // 只加载词库到 wordDatabase，不影响页面显示
    renderTable();
});

function updateWordDatabase() {
    wordDatabase = {};
    userEditedWords.forEach(([word1, word2]) => {
        if (word1 && word2) {
            wordDatabase[word1] = word2;
        }
    });
}

function deleteRow(btn) {
    const row = btn.closest('tr');
    const word1 = row.cells[1].getElementsByTagName('input')[0].value.trim();
    const word2 = row.cells[2].getElementsByTagName('input')[0].value.trim();
    userEditedWords = userEditedWords.filter(([w1, w2]) => w1 !== word1 || w2 !== word2);
    row.parentNode.removeChild(row);
    updateWordDatabase();
    renderTable();
}
