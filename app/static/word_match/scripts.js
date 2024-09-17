

$(document).ready(function () {
    let words = {
        "苹果": "apple",
        "香蕉": "banana",
        "橙子": "orange"
    };

    let selectedBlock = null;
    let currentFile = null;

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function createBlocks() {
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.innerHTML = ''; // 清空现有游戏板
        const blocks = [];
        for (let word in words) {
            blocks.push(`<div class="block" data-word="${word}">${word}</div>`);
            blocks.push(`<div class="block" data-word="${words[word]}">${words[word]}</div>`);
        }
        shuffleArray(blocks);
        blocks.forEach(block => gameBoard.appendChild(createBlock(block)));
        updateTotalWords(); // 更新单词总数
        initializeDragAndDrop(); // 重新初始化拖拽和放置
        bindClickEvents(); // 重新绑定点击事件
        adjustGameBoard(); // 调整游戏板
    }

    function createBlock(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.firstChild;
    }

    function initializeDragAndDrop() {
        $(".block").draggable({
            revert: "invalid",
            start: function (event, ui) {
                $(this).data("originalPosition", ui.position);
            },
            stop: function (event, ui) {
                if (!$(this).data("validDrop")) {
                    $(this).animate({
                        top: $(this).data("originalPosition").top,
                        left: $(this).data("originalPosition").left
                    }, 200);
                }
            }
        });
        $(".block").droppable({
            accept: ".block",
            drop: function (event, ui) {
                const droppedBlock = ui.draggable;
                const droppedOnBlock = $(this);

                const firstWord = droppedBlock.attr("data-word");
                const secondWord = droppedOnBlock.attr("data-word");

                if (words[firstWord] === secondWord || words[secondWord] === firstWord) {
                    iziToast.success({
                        title: '正确',
                        message: '匹配成功！',
                        position: 'topRight'
                    });

                    // 添加消失动画
                    droppedBlock.addClass("disappearing");
                    droppedOnBlock.addClass("disappearing");

                    // 等待动画完成后移除元素
                    setTimeout(() => {
                        droppedBlock.remove();
                        droppedOnBlock.remove();
                        updateScore(1, 0);
                        updateTotalWords();
                        checkGameOver(); // 检查游戏是否结束
                    }, 500); // 等待动画完成后移除元素
                } else {
                    iziToast.error({
                        title: '错误',
                        message: '匹配失败！',
                        position: 'topRight'
                    });
                    updateScore(0, 1);
                }
            }
        });
    }

    function bindClickEvents() {
        $(".block").on("click", function () {
            if (selectedBlock && selectedBlock[0] === this) {
                selectedBlock.removeClass("selected");
                selectedBlock = null;
            } else {
                if (selectedBlock) {
                    const firstWord = selectedBlock.attr("data-word");
                    const secondWord = $(this).attr("data-word");

                    if (words[firstWord] === secondWord || words[secondWord] === firstWord) {
                        iziToast.success({
                            title: '正确',
                            message: '匹配成功！',
                            position: 'topRight'
                        });

                        const firstBlock = selectedBlock;
                        const secondBlock = $(this);

                        // 添加消失动画
                        firstBlock.addClass("disappearing");
                        secondBlock.addClass("disappearing");

                        // 等待动画完成后移除元素
                        setTimeout(() => {
                            firstBlock.remove();
                            secondBlock.remove();
                            updateScore(1, 0); // 更新计分板
                            updateTotalWords(); // 更新单词总数
                            selectedBlock = null; // 重置 selectedBlock
                            checkGameOver(); // 检查游戏是否结束
                        }, 500); // 等待动画完成后移除元素
                    } else {
                        iziToast.error({
                            title: '错误',
                            message: '匹配失败！',
                            position: 'topRight'
                        });
                        updateScore(0, 1); // 更新计分板
                        selectedBlock.removeClass("selected");
                        $(this).removeClass("selected");
                        selectedBlock = null; // 重置选中的块
                    }
                } else {
                    selectedBlock = $(this).addClass("selected");
                }
            }
        });
    }

    createBlocks();

    function updateScore(correct, incorrect) {
        const correctCount = parseInt($("#correct").text());
        const incorrectCount = parseInt($("#incorrect").text());
        $("#correct").text(correctCount + correct);
        $("#incorrect").text(incorrectCount + incorrect);
        updateScoreboard();
    }

    function updateTotalWords() {
        const total = Math.floor(Object.keys(words).length); // 使用Math.floor取整
        $("#total").text(total);
        updateScoreboard();
    }

    function updateScoreboard() {
        const correctCount = parseInt($("#correct").text());
        const incorrectCount = parseInt($("#incorrect").text());
        const total = parseInt($("#total").text());

        $("#correctLeft, #correctRight").text(correctCount);
        $("#incorrectLeft, #incorrectRight").text(incorrectCount);
        $("#totalLeft, #totalRight").text(total);
    }

    $('#loadFileBtnLeft, #loadFileBtnRight').on('click', function (e) {
        e.stopPropagation(); // 阻止事件冒泡
        $('#fileInput').click();
    });

    function parseTxt(txtContent) {
        const lines = txtContent.split('\n');
        const newWords = {};
        for (let i = 0; i < lines.length; i += 2) {
            const english = lines[i].trim();
            const chinese = lines[i + 1] ? lines[i + 1].trim() : '';
            if (english && chinese) {
                newWords[chinese] = english;
            }
        }
        return newWords;
    }

    $('#fileInput').on('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const content = e.target.result;
                if (file.name.endsWith('.txt')) {
                    words = parseTxt(content);
                } else if (file.name.endsWith('.json')) {
                    try {
                        words = JSON.parse(content);
                    } catch (error) {
                        console.error('Error parsing JSON:', error);
                        iziToast.error({
                            title: '错误',
                            message: 'JSON 文件格式不正确',
                            position: 'topRight'
                        });
                        return;
                    }
                } else {
                    iziToast.error({
                        title: '错误',
                        message: '不支持的文件格式',
                        position: 'topRight'
                    });
                    return;
                }
                createBlocks(); // 重新创建块并绑定事件
                updateScoreboard(); // 更新计分板
                iziToast.success({
                    title: '成功',
                    message: '文件加载成功',
                    position: 'topRight'
                });
            };
            reader.readAsText(file);
        }
    });

    $('#resetGameBtnLeft, #resetGameBtnRight').on('click', function (e) {
        e.stopPropagation(); // 阻止事件冒泡
        $("#gameBoard").empty();
        $("#correct, #incorrect").text("0");
        createBlocks();
        $("#gameOver").hide();
        $("#scoreboard").hide();
        updateScoreboard();
    });

    function adjustGameBoard() {
        const gameBoard = document.getElementById('gameBoard');
        const availableWidth = gameBoard.clientWidth - 40; // 减去 padding
        const gap = 20; // 增加间隙
        const minBlockWidth = 120; // 块的最小宽度

        // 计算每行可以容纳的块数
        const blocksPerRow = Math.floor((availableWidth - (gap * (10 - 1))) / (minBlockWidth + gap));
        const blockWidth = (availableWidth - (blocksPerRow - 1) * gap) / blocksPerRow;

        // 更新网格布局
        gameBoard.style.gridTemplateColumns = `repeat(${blocksPerRow}, ${blockWidth}px)`;
    }

    function showScoreboardToast() {
        const correctCount = parseInt($("#correct").text());
        const incorrectCount = parseInt($("#incorrect").text());
        const total = Math.floor(Object.keys(words).length);
        iziToast.show({
            title: '计分板',
            message: `正确次数: ${correctCount}<br>错误次数: ${incorrectCount}<br>单词总数: ${total}`,
            position: 'topCenter', // 将toast显示在屏幕顶部中间
            timeout: 5000,
            close: true,
            progressBar: true,
            transitionIn: 'bounceInDown',
            transitionOut: 'fadeOutUp'
        });
    }

    function showScoreboardInPage() {
        const correctCount = parseInt($("#correct").text());
        const incorrectCount = parseInt($("#incorrect").text());
        const total = Math.floor(Object.keys(words).length);
        $("#scoreboardDisplay").html(`
            <p>正确次数: ${correctCount}</p>
            <p>错误次数: ${incorrectCount}</p>
            <p>单词总数: ${total}</p>
        `).show();
    }

    function hideScoreboard() {
        $("#scoreboardDisplay").hide();
    }

    $("#titleBox").on('click', function () {
        showScoreboardToast();
    });

    $("#playAgainBtn").on('click', function () {
        $("#gameOver").hide();
        createBlocks();
        hideScoreboard(); // 隐藏计分板
    });

    function checkGameOver() {
        if ($("#gameBoard").children().length === 0) {
            $("#gameOver").show().addClass('victory'); // Add victory class
            showScoreboardInPage(); // Show scoreboard
        }
    }

    window.addEventListener('resize', adjustGameBoard);
    window.addEventListener('load', adjustGameBoard); // 确保在页面加载时调用

    // 悬浮窗的展开和收起
    $('#floatingWindowLeft, #floatingWindowRight').on('click', function () {
        $(this).toggleClass('expanded');
    });
    $('#editWordsBtnLeft, #editWordsBtnRight').on('click', function (e) {
        e.stopPropagation(); // 阻止事件冒泡
        window.open('/word_editor', '_blank');
    });
});
