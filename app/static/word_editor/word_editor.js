let words = {};
let currentPage = 1;
const itemsPerPage = 20;
let currentFilename = '';
let wordDatabase = {}; // 本地词库
let isLoggedIn = false; // 用户登录状态

function loadWords() {
    $('#wordTableBody').empty();
    Object.entries(words).forEach(([word1, word2]) => {
        addRowWithData(word1, word2);
    });
    updatePagination();
}

function renderTable() {
    const tbody = document.getElementById('wordTableBody');
    tbody.innerHTML = '';
    const wordsArray = Object.entries(words);
    const totalPages = Math.ceil(wordsArray.length / itemsPerPage);
    
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const wordsToShow = wordsArray.slice(startIndex, endIndex);

    wordsToShow.forEach(([word1, word2]) => {
        addRowWithData(word1, word2);
    });

    if (wordsArray.length === 0) {
        addRowWithData('', '');
    }

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(Object.keys(words).length / itemsPerPage);
    $('#pageInfo').text(`第 ${currentPage} 页，共 ${totalPages} 页`);
    $('#prevPage').prop('disabled', currentPage === 1);
    $('#nextPage').prop('disabled', currentPage === totalPages);
}

function changePage(delta) {
    const totalPages = Math.ceil(Object.keys(words).length / itemsPerPage);
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    renderTable();
}

function addRowWithData(word1, word2) {
    const newRow = $('<tr>');
    newRow.html(`
        <td><input type="checkbox" name="wordCheck"></td>
        <td class="input-container">
            <input type="text" name="word1" value="${word1}" class="word-input" oninput="handleInput(this)">
            <div class="autocomplete-items"></div>
        </td>
        <td><input type="text" name="word2" value="${word2}" class="word-input"></td>
        <td><button onclick="deleteRow(this)" class="delete-btn">删除</button></td>
    `);
    $('#wordTableBody').append(newRow);
}

function addRow() {
    addRowWithData('', '');
}

function deleteRow(btn) {
    const row = $(btn).closest('tr');
    const word1 = row.find('input[name="word1"]').val().trim();
    const word2 = row.find('input[name="word2"]').val().trim();
    
    // 从 words 对象中删除该单词
    delete words[word1];
    
    // 重新渲染表格
    renderTable();
    
    showMessage('单词已删除');
}

function batchDelete() {
    $('input[name="wordCheck"]:checked').closest('tr').remove();
}

function toggleAllCheckboxes() {
    const isChecked = $('#selectAll').prop('checked');
    $('input[name="wordCheck"]').prop('checked', isChecked);
}

function openBatchAddModal() {
    $('#batchAddModal').show();
}

function closeBatchAddModal() {
    $('#batchAddModal').hide();
}

function processBatchInput() {
    const input = $('#batchInput').val();
    const lines = input.split('\n');
    for (let i = 0; i < lines.length; i += 2) {
        if (lines[i] && lines[i + 1]) {
            addRowWithData(lines[i], lines[i + 1]);
        }
    }
    closeBatchAddModal();
}

function saveToServer() {
    if (!isLoggedIn) {
        showLoginModal();
        return;
    }

    const words = getAllWordsFromTable();

    if (!currentFilename) {
        currentFilename = prompt("请输入文件名：", "new_word_file.json");
        if (!currentFilename) return;
    }

    $.ajax({
        url: '/save_word_file',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ filename: currentFilename, words: words }),
        success: function(response) {
            if (response.success) {
                showMessage('文件已保存到服务器');
                notifyParentWindow();
                $('#filename').text(` - ${currentFilename}`);
            } else {
                showMessage('保存失败: ' + response.error, 'error');
            }
        },
        error: function() {
            showMessage('保存失败，请稍后重试', 'error');
        }
    });
}

function getAllWordsFromTable() {
    const words = {};
    $('#wordTableBody tr').each(function() {
        const word1 = $(this).find('input[name="word1"]').val().trim();
        const word2 = $(this).find('input[name="word2"]').val().trim();
        if (word1 && word2) {
            words[word1] = word2;
        }
    });
    return words;
}

function saveJSON() {
    const words = getWordsFromTable();
    const jsonContent = JSON.stringify(words, null, 2);
    downloadFile(jsonContent, currentFilename || 'new_word_file.json', 'application/json');
}

function saveTXT() {
    const words = getWordsFromTable();
    let txtContent = '';
    Object.entries(words).forEach(([word1, word2]) => {
        txtContent += `${word1}\n${word2}\n`;
    });
    downloadFile(txtContent, (currentFilename || 'new_word_file').split('.')[0] + '.txt', 'text/plain');
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

function getWordsFromTable() {
    const words = {};
    $('#wordTableBody tr').each(function() {
        const word1 = $(this).find('input[name="word1"]').val().trim();
        const word2 = $(this).find('input[name="word2"]').val().trim();
        if (word1 && word2) {
            words[word1] = word2;
        }
    });
    return words;
}

function loadFromServer(filename) {
    $.ajax({
        url: `/load_word_file/${filename}`,
        type: 'GET',
        success: function(response) {
            if (response.success) {
                words = response.words;
                currentFilename = filename;
                currentPage = 1;
                renderTable();
                $('#filename').text(` - ${filename}`);
                showMessage('文件已从服务器加载');
            } else {
                showMessage('加载失败: ' + response.error, 'error');
            }
        },
        error: function() {
            showMessage('加载失败，请稍后重试', 'error');
        }
    });
}

function loadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.txt';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                if (file.name.endsWith('.json')) {
                    words = JSON.parse(event.target.result);
                } else {
                    const lines = event.target.result.split('\n');
                    words = {};
                    for (let i = 0; i < lines.length; i += 2) {
                        if (lines[i] && lines[i + 1]) {
                            words[lines[i].trim()] = lines[i + 1].trim();
                        }
                    }
                }
                currentFilename = file.name;
                currentPage = 1;
                renderTable();
                $('#filename').text(` - ${file.name}`);
                showMessage('文件已加载');
            } catch (error) {
                showMessage('文件格式错误', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function notifyParentWindow() {
    if (window.opener && !window.opener.closed) {
        window.opener.postMessage('wordFileUpdated', '*');
    }
}

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
                        showMessage(`已加载 ${totalWords} 个单词到智能提示词库`);
                    }
                };
                reader.readAsText(file);
            }
        }
    };
    input.click();
}

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

function showMessage(message, type = 'success') {
    iziToast[type]({
        title: type === 'success' ? '成功' : '错误',
        message: message,
    });
}

function showLoginModal() {
    // 显示登录弹窗的代码
    // ...
}

$(document).ready(function() {
    loadDictionaryList(); // 加载词库
    
    // 检查登录状态
    $.get('/check_login', function(response) {
        isLoggedIn = response.logged_in;
        updateUIForLoginStatus();
    });

    // 从URL获取文件名
    const urlParams = new URLSearchParams(window.location.search);
    const filenameParam = urlParams.get('filename');
    if (filenameParam) {
        currentFilename = filenameParam;
        loadFromServer(filenameParam);
    } else {
        renderTable(); // 如果没有文件名参数，加载空白编辑器
    }
});

function updateUIForLoginStatus() {
    if (isLoggedIn) {
        $('#loadFromServerBtn').show();
        $('#loginBtn, #registerBtn').hide();
    } else {
        $('#loadFromServerBtn').hide();
        $('#loginBtn, #registerBtn').show();
    }
}

function loadFromServerDialog() {
    $.get('/get_word_file_list', function(files) {
        let fileList = '';
        files.forEach(file => {
            fileList += `<div class="file-item">
                <span>${file}</span>
                <button onclick="loadFromServer('${file}')">加载</button>
                <button onclick="deleteWordFile('${file}')">删除</button>
            </div>`;
        });
        
        $('#fileListModal .modal-body').html(fileList);
        $('#fileListModal').show();
    });
}

function deleteWordFile(filename) {
    if (confirm(`确定要删除文件 ${filename} 吗？`)) {
        $.post('/delete_word_file', {filename: filename}, function(response) {
            if (response.success) {
                showMessage('文件已删除');
                loadFromServerDialog(); // 刷新文件列表
            } else {
                showMessage('删除失败: ' + response.error, 'error');
            }
        });
    }
}

// 添加键盘事件处理
let currentFocus = -1;
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

function addActive(autocompleteItems) {
    if (!autocompleteItems) return false;
    removeActive(autocompleteItems);
    if (currentFocus >= autocompleteItems.children.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = (autocompleteItems.children.length - 1);
    autocompleteItems.children[currentFocus].classList.add("autocomplete-active");
}

function removeActive(autocompleteItems) {
    for (let i = 0; i < autocompleteItems.children.length; i++) {
        autocompleteItems.children[i].classList.remove("autocomplete-active");
    }
}

// 点击其他地方时关闭自动完成
document.addEventListener('click', function (e) {
    const autocompleteItems = document.querySelectorAll('.autocomplete-items');
    autocompleteItems.forEach(item => {
        if (e.target !== item && !item.contains(e.target)) {
            item.style.display = 'none';
        }
    });
});