const API_KEY = ""; // Get yours at https://platform.sulu.sh/apis/judge0

const AUTH_HEADERS = API_KEY ? {
    "Authorization": `Bearer ${API_KEY}`
} : {};

let OPENROUTER_API_KEY= localStorage.getItem('OPENROUTER_API_KEY') || '';
function setOpenRouterApiKey(key){
    OPENROUTER_API_KEY=key;
    localStorage.setItem('OPENROUTER_API_KEY',key);
}

let SELECTED_MODEL = localStorage.getItem('SELECTED_MODEL') || 'meta-llama/llama-3.2-3b-instruct:free';

function setSelectedModel(model){
    SELECTED_MODEL=model;
    localStorage.setItem("SELECTED_MODEL",model)
}

const CE = "CE";
const EXTRA_CE = "EXTRA_CE";

const AUTHENTICATED_CE_BASE_URL = "https://judge0-ce.p.sulu.sh";
const AUTHENTICATED_EXTRA_CE_BASE_URL = "https://judge0-extra-ce.p.sulu.sh";

var AUTHENTICATED_BASE_URL = {};
AUTHENTICATED_BASE_URL[CE] = AUTHENTICATED_CE_BASE_URL;
AUTHENTICATED_BASE_URL[EXTRA_CE] = AUTHENTICATED_EXTRA_CE_BASE_URL;

const UNAUTHENTICATED_CE_BASE_URL = "https://ce.judge0.com";
const UNAUTHENTICATED_EXTRA_CE_BASE_URL = "https://extra-ce.judge0.com";

var UNAUTHENTICATED_BASE_URL = {};
UNAUTHENTICATED_BASE_URL[CE] = UNAUTHENTICATED_CE_BASE_URL;
UNAUTHENTICATED_BASE_URL[EXTRA_CE] = UNAUTHENTICATED_EXTRA_CE_BASE_URL;

const INITIAL_WAIT_TIME_MS = 0;
const WAIT_TIME_FUNCTION = i => 100;
const MAX_PROBE_REQUESTS = 50;

var fontSize = 13;

var layout;

var sourceEditor;
var stdinEditor;
var stdoutEditor;

var $selectLanguage;
var $compilerOptions;
var $commandLineArguments;
var $runBtn;
var $statusLine;

var timeStart;
var timeEnd;

var sqliteAdditionalFiles;
var languages = {};

var layoutConfig = {
    settings: {
        showPopoutIcon: false,
        reorderEnabled: true
    },
    content: [{
        type: "row",
        content: [{
            type:"row",
            width: 80,
            content: [{
                type: "component",
                width: 66,
                componentName: "source",
                id: "source",
                title: "Source Code",
                isClosable: false,
                componentState: {
                    readOnly: false
                }
            }, {
                type: "column",
                content: [{
                    type: "component",
                    componentName: "stdin",
                    id: "stdin",
                    title: "Input",
                    isClosable: false,
                    componentState: {
                        readOnly: false
                    }
                }, {
                    type: "component",
                    componentName: "stdout",
                    id: "stdout",
                    title: "Output",
                    isClosable: false,
                    componentState: {
                        readOnly: true
                    }
                }]
            }]
        },{
            type: "component",
            width:20,
            componentName: "chat",
            id: "chat",
            title: "Code Assistant",
            isClosable: false,
            componentState: {
                readOnly: true
            }
        }]
    }]
};

const PUTER = puter.env === "app";
var gPuterFile;

function encode(str) {
    return btoa(unescape(encodeURIComponent(str || "")));
}

function decode(bytes) {
    var escaped = escape(atob(bytes || ""));
    try {
        return decodeURIComponent(escaped);
    } catch {
        return unescape(escaped);
    }
}


function showError(title, content) {
    $("#judge0-site-modal #title").html(title);
    $("#judge0-site-modal .content").html(content);

    let reportTitle = encodeURIComponent(`Error on ${window.location.href}`);
    let reportBody = encodeURIComponent(
        `**Error Title**: ${title}\n` +
        `**Error Timestamp**: \`${new Date()}\`\n` +
        `**Origin**: ${window.location.href}\n` +
        `**Description**:\n${content}`
    );

    $("#report-problem-btn").attr("href", `https://github.com/judge0/ide/issues/new?title=${reportTitle}&body=${reportBody}`);
    $("#judge0-site-modal").modal("show");
}

function showHttpError(jqXHR) {
    showError(`${jqXHR.statusText} (${jqXHR.status})`, `<pre>${JSON.stringify(jqXHR, null, 4)}</pre>`);
}

function handleRunError(jqXHR) {
    showHttpError(jqXHR);
    $runBtn.removeClass("disabled");

    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "runError",
        data: jqXHR
    })), "*");
}

async function handleResult(data) {
    const tat = Math.round(performance.now() - timeStart);
    console.log(`It took ${tat}ms to get submission result.`);

    const status = data.status;
    const stdout = decode(data.stdout);
    const compileOutput = decode(data.compile_output);
    const time = (data.time === null ? "-" : data.time + "s");
    const memory = (data.memory === null ? "-" : data.memory + "KB");

    $statusLine.html(`${status.description}, ${time}, ${memory} (TAT: ${tat}ms)`);

    const output = [compileOutput, stdout].join("\n").trim();

    stdoutEditor.setValue(output);

    if(status.id === 6){
        const selectedLanguage =$selectLanguage.find(":selected").text();
        handleSyntaxError(sourceEditor.getValue(), selectedLanguage, output);
    }

    $runBtn.removeClass("disabled");

    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "postExecution",
        status: data.status,
        time: data.time,
        memory: data.memory,
        output: output
    })), "*");}

async function handleSyntaxError(sourceCode, language, error){
    if(!OPENROUTER_API_KEY){
        showError("API Key Required","Please set your OpenRouter API key in Code Assistant pannel to get AI suggestions for syntax errors")
        return
    }

    const errorLineMatch = error.match(/error|Error on line(\d+)/)
    const errorLine = errorLineMatch ? parseInt(errorLineMatch[1]): null

    if (errorLine) {
        sourceEditor.deltaDecorations([], [{
            range: new monaco.Range(errorLine,1, errorLine,1),
            options:{
                isWholeLine: true,
                className:'errorHighlight',
                glyphMarginClassName:'errorGlyphMargin'
            }
        }])
    }
    try{
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions',{
            method: 'POST',
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer' : window.location.origin,
                'X-Title' : 'Judge0 IDE'
            },
            body: JSON.stringify({
                model:SELECTED_MODEL,
                messages:[{
                    role:'system',
                    content: `You are an expert programming assistant, A user has code that produced a syntax error. Analyse the code, the provide a specifix fix. Format your response as a diff in the following format:

                    ERROR_ANALYSIS: <brief explanation of the error>

                    DIFF:
                    <show only the lines that need to change, with - for removals and + for additions>
                    EXPLANATION:<brief explanation of the fix>
                    Keep your response concise and focused on the specific syntax error.`

                },
                {
                    role:'user',
                    content: `Language :${language}\n\n Code:\n ${sourceCode}\n\nError:\n${error}`
                }]
            })
        })

        if (!response.ok){
            throw new Error(`API request failed: ${response.statusText}` )
        }
        
        const data = await response.json()
        const suggestion = data.choices[0].message.content 
        
        const diffMatch= suggestion.match(/DIFF:\n([\s\S]*?)(?=\n\nEXPLANATION:|$)/)
        const explanationMatch=suggestion.match(/EXPLANATION:\s*([\s\S]*?)$/)

        if(diffMatch){
            const formattedDiff= diffMatch[1]
                                .split('\n')
                                .map(line=> {
                                    if(line.startsWith('+')){
                                        return `<span class="text-[#51cf66]"> ${line}</span>`
                                    } else if (line.startsWith('-')){
                                        return `<span class="text-[#ff6b6b]">${line}</span>`
                                    }
                                    return `<span class="text-[#8a8a8a]">${line}</span>`
                                })
                                .join('\n')
            const diffContainer=document.createElement('div')
            diffContainer.className = 'diff-suggestion bg-[#1e1e1e] p-4 rounded-lg border border-[#3e3e42] fixed bottom-4 right-4 w-96 shadow-lg flex flex-col max-h-[400px]';
            diffContainer.innerHTML = `
                <div class="diff-header flex justify-between items-center mb-2 sticky top-0 bg-[#1e1e1e] p-2 border-b border-[#3e3e42] z-10">
                    <h3 class="text-[#cccccc] font-semibold"> Suggested Fix</h3>
                    <div class="flex gap-2">
                        <button class="accept-diff bg-[#0078d4] hover:bg-[#006bb3] text-white px-3 py-1 rounded">Accept</button>
                        <button class="reject-diff bg-[#3e3e42] hover:bg-[#4e4e52] text-white px-3 py-1 rounded">Reject</button>
                    </div>
                </div>
                <div class="diff-content text-sm font-mono text-[#cccccc] overflow-y-auto whitespace-pre p-2 flex-1">
                    ${formattedDiff}
                </div>
                ${explanationMatch ? `<p class="mt-2 text-sm text-[#8a8a8a]">${explanationMatch[1]}</p>` : ''}
            `
            const existingDiff= document.querySelector('.diff-suggestion')
            if(existingDiff){
                existingDiff.remove()
            }
            document.body.appendChild(diffContainer)
            diffContainer.querySelector('.accept-diff').addEventListener(
                'click',() => {
                    const diff =diffMatch[1]
                    console.log('Raw diff:', diff)
                    const lines= diff.split('\n').map(line=> line.trimEnd())
                    .filter(line=> line.length >0)
                    console.log('Parsed Lines:', lines)
                    let currentCode =sourceEditor.getValue().split('\n')
                    console.log('Current code lines:', currentCode)


                    let changes=[]

                    let currentChange ={ removals:[], additions:[]}

                    lines.forEach(line => {
                        if (line.startsWith('-')){
                            currentChange.removals.push(line.substring(1))
                        } else if(line.startsWith('+')){
                            currentChange.additions.push(line.substring(1))
                        } else {
                            if(currentChange.removals.length >0 || currentChange.additions.length >0){
                                changes.push(currentChange)
                                currentChange={removals:[], additions:[]}
                            }
                        }

                    })
                    if(currentChange.removals.length >0 || currentChange.additions.length >0){
                        changes.push(currentChange)
                    }

                    console.log('Grouped changes:', changes)

                    changes.forEach(change => {
                        let targetLine= -1
                        if(change.removals.length >0 ){
                            const lineToFind =change.removals[0]
                            targetLine =currentCode.findIndex(
                                codeLine => codeLine.trim() === lineToFind.trim()
                            )
                        }

                        if(targetLine ===-1 && errorLine){
                            targetLine=errorLine-1
                        }

                        if(targetLine === -1){
                            const contextLines= lines.filter(line => !line.startsWith('+') && !line.startsWith('-'))
                            for (const contextLine of contextLines){
                                targetLine = currentCode.findIndex(
                                    codeLine => codeLine.trim() ===contextLine.trim()

                                )
                                if (targetLine !== -1) break
                            }
                        }
                        if(targetLine !== -1){
                            console.log("Applying change at Line:",targetLine)
                            console.log("Removing Lines:", change.removals)
                            console.log("Adding Lines:", change.additions)
                            if(change.removals.length>0){
                                currentCode.splice(targetLine, change.removals.length)
                            }
                            if(change.additions.length>0){
                                currentCode.splice(targetLine,0, ...change.additions)
                            }
                        }else {
                            console.log('Could not find target line for change')
                        }
                    })

                    const newContent =currentCode.join('\n')
                    console.log("new content:", newContent)

                    sourceEditor.setValue(newContent)
                    diffContainer.remove()

                })
                diffContainer.querySelector('.reject-diff').addEventListener('click',() => {diffContainer.remove()

                })
        }
    } catch(error) {
        console.error("error getting sugestion:", error)
        showError ("error", "Failed to get code suggestion. Please set your open router key and try again...")
    }
}

async function getSelectedLanguage() {
    return getLanguage(getSelectedLanguageFlavor(), getSelectedLanguageId())
}

function getSelectedLanguageId() {
    return parseInt($selectLanguage.val());
}

function getSelectedLanguageFlavor() {
    return $selectLanguage.find(":selected").attr("flavor");
}

function run() {
    if (sourceEditor.getValue().trim() === "") {
        showError("Error", "Source code can't be empty!");
        return;
    } else {
        $runBtn.addClass("disabled");
    }

    stdoutEditor.setValue("");
    $statusLine.html("");

    let x = layout.root.getItemsById("stdout")[0];
    x.parent.header.parent.setActiveContentItem(x);

    let sourceValue = encode(sourceEditor.getValue());
    let stdinValue = encode(stdinEditor.getValue());
    let languageId = getSelectedLanguageId();
    let compilerOptions = $compilerOptions.val();
    let commandLineArguments = $commandLineArguments.val();

    let flavor = getSelectedLanguageFlavor();

    if (languageId === 44) {
        sourceValue = sourceEditor.getValue();
    }

    let data = {
        source_code: sourceValue,
        language_id: languageId,
        stdin: stdinValue,
        compiler_options: compilerOptions,
        command_line_arguments: commandLineArguments,
        redirect_stderr_to_stdout: true
    };

    let sendRequest = function (data) {
        window.top.postMessage(JSON.parse(JSON.stringify({
            event: "preExecution",
            source_code: sourceEditor.getValue(),
            language_id: languageId,
            flavor: flavor,
            stdin: stdinEditor.getValue(),
            compiler_options: compilerOptions,
            command_line_arguments: commandLineArguments
        })), "*");

        timeStart = performance.now();
        $.ajax({
            url: `${AUTHENTICATED_BASE_URL[flavor]}/submissions?base64_encoded=true&wait=false`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(data),
            headers: AUTH_HEADERS,
            success: function (data, textStatus, request) {
                console.log(`Your submission token is: ${data.token}`);
                let region = request.getResponseHeader('X-Judge0-Region');
                setTimeout(fetchSubmission.bind(null, flavor, region, data.token, 1), INITIAL_WAIT_TIME_MS);
            },
            error: handleRunError
        });
    }

    if (languageId === 82) {
        if (!sqliteAdditionalFiles) {
            $.ajax({
                url: `./data/additional_files_zip_base64.txt`,
                contentType: "text/plain",
                success: function (responseData) {
                    sqliteAdditionalFiles = responseData;
                    data["additional_files"] = sqliteAdditionalFiles;
                    sendRequest(data);
                },
                error: handleRunError
            });
        }
        else {
            data["additional_files"] = sqliteAdditionalFiles;
            sendRequest(data);
        }
    } else {
        sendRequest(data);
    }
}

function fetchSubmission(flavor, region, submission_token, iteration) {
    if (iteration >= MAX_PROBE_REQUESTS) {
        handleRunError({
            statusText: "Maximum number of probe requests reached.",
            status: 504
        }, null, null);
        return;
    }

    $.ajax({
        url: `${UNAUTHENTICATED_BASE_URL[flavor]}/submissions/${submission_token}?base64_encoded=true`,
        headers: {
            "X-Judge0-Region": region
        },
        success: function (data) {
            if (data.status.id <= 2) { // In Queue or Processing
                $statusLine.html(data.status.description);
                setTimeout(fetchSubmission.bind(null, flavor, region, submission_token, iteration + 1), WAIT_TIME_FUNCTION(iteration));
            } else {
                handleResult(data);
            }
        },
        error: handleRunError
    });
}

function setSourceCodeName(name) {
    $(".lm_title")[0].innerText = name;
}

function getSourceCodeName() {
    return $(".lm_title")[0].innerText;
}

function openFile(content, filename) {
    clear();
    sourceEditor.setValue(content);
    selectLanguageForExtension(filename.split(".").pop());
    setSourceCodeName(filename);
}

function saveFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

async function openAction() {
    if (PUTER) {
        gPuterFile = await puter.ui.showOpenFilePicker();
        openFile(await (await gPuterFile.read()).text(), gPuterFile.name);
    } else {
        document.getElementById("open-file-input").click();
    }
}

async function saveAction() {
    if (PUTER) {
        if (gPuterFile) {
            gPuterFile.write(sourceEditor.getValue());
        } else {
            gPuterFile = await puter.ui.showSaveFilePicker(sourceEditor.getValue(), getSourceCodeName());
            setSourceCodeName(gPuterFile.name);
        }
    } else {
        saveFile(sourceEditor.getValue(), getSourceCodeName());
    }
}

function setFontSizeForAllEditors(fontSize) {
    sourceEditor.updateOptions({ fontSize: fontSize });
    stdinEditor.updateOptions({ fontSize: fontSize });
    stdoutEditor.updateOptions({ fontSize: fontSize });
}

async function loadLangauges() {
    return new Promise((resolve, reject) => {
        let options = [];

        $.ajax({
            url: UNAUTHENTICATED_CE_BASE_URL + "/languages",
            success: function (data) {
                for (let i = 0; i < data.length; i++) {
                    let language = data[i];
                    let option = new Option(language.name, language.id);
                    option.setAttribute("flavor", CE);
                    option.setAttribute("langauge_mode", getEditorLanguageMode(language.name));

                    if (language.id !== 89) {
                        options.push(option);
                    }

                    if (language.id === DEFAULT_LANGUAGE_ID) {
                        option.selected = true;
                    }
                }
            },
            error: reject
        }).always(function () {
            $.ajax({
                url: UNAUTHENTICATED_EXTRA_CE_BASE_URL + "/languages",
                success: function (data) {
                    for (let i = 0; i < data.length; i++) {
                        let language = data[i];
                        let option = new Option(language.name, language.id);
                        option.setAttribute("flavor", EXTRA_CE);
                        option.setAttribute("langauge_mode", getEditorLanguageMode(language.name));

                        if (options.findIndex((t) => (t.text === option.text)) === -1 && language.id !== 89) {
                            options.push(option);
                        }
                    }
                },
                error: reject
            }).always(function () {
                options.sort((a, b) => a.text.localeCompare(b.text));
                $selectLanguage.append(options);
                resolve();
            });
        });
    });
};

async function loadSelectedLanguage(skipSetDefaultSourceCodeName = false) {
    monaco.editor.setModelLanguage(sourceEditor.getModel(), $selectLanguage.find(":selected").attr("langauge_mode"));

    if (!skipSetDefaultSourceCodeName) {
        setSourceCodeName((await getSelectedLanguage()).source_file);
    }
}

function selectLanguageByFlavorAndId(languageId, flavor) {
    let option = $selectLanguage.find(`[value=${languageId}][flavor=${flavor}]`);
    if (option.length) {
        option.prop("selected", true);
        $selectLanguage.trigger("change", { skipSetDefaultSourceCodeName: true });
    }
}

function selectLanguageForExtension(extension) {
    let language = getLanguageForExtension(extension);
    selectLanguageByFlavorAndId(language.language_id, language.flavor);
}

async function getLanguage(flavor, languageId) {
    return new Promise((resolve, reject) => {
        if (languages[flavor] && languages[flavor][languageId]) {
            resolve(languages[flavor][languageId]);
            return;
        }

        $.ajax({
            url: `${UNAUTHENTICATED_BASE_URL[flavor]}/languages/${languageId}`,
            success: function (data) {
                if (!languages[flavor]) {
                    languages[flavor] = {};
                }

                languages[flavor][languageId] = data;
                resolve(data);
            },
            error: reject
        });
    });
}

function setDefaults() {
    setFontSizeForAllEditors(fontSize);
    sourceEditor.setValue(DEFAULT_SOURCE);
    stdinEditor.setValue(DEFAULT_STDIN);
    $compilerOptions.val(DEFAULT_COMPILER_OPTIONS);
    $commandLineArguments.val(DEFAULT_CMD_ARGUMENTS);

    $statusLine.html("");

    loadSelectedLanguage();
}

function clear() {
    sourceEditor.setValue("");
    stdinEditor.setValue("");
    $compilerOptions.val("");
    $commandLineArguments.val("");

    $statusLine.html("");
}

function refreshSiteContentHeight() {
    $("#judge0-site-content").height($(window).height() - $("#judge0-site-navigation").outerHeight());
}

function refreshLayoutSize() {
    refreshSiteContentHeight();
    layout.updateSize();
}

$(window).resize(refreshLayoutSize);

$(document).ready(async function () {
    $("#select-language").dropdown();
    $("[data-content]").popup({
        lastResort: "left center"
    });

    refreshSiteContentHeight();

    console.log("Hey, Judge0 IDE is open-sourced: https://github.com/judge0/ide. Have fun!");

    $selectLanguage = $("#select-language");
    $selectLanguage.change(function (event, data) {
        let skipSetDefaultSourceCodeName = (data && data.skipSetDefaultSourceCodeName) || !!gPuterFile;
        loadSelectedLanguage(skipSetDefaultSourceCodeName);
    });

    await loadLangauges();

    $compilerOptions = $("#compiler-options");
    $commandLineArguments = $("#command-line-arguments");

    $runBtn = $("#run-btn");
    $runBtn.click(run);

    $("#open-file-input").change(function (e) {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = function (e) {
                openFile(e.target.result, selectedFile.name);
            };

            reader.onerror = function (e) {
                showError("Error", "Error reading file: " + e.target.error);
            };

            reader.readAsText(selectedFile);
        }
    });

    $statusLine = $("#judge0-status-line");

    $(document).on("keydown", "body", function (e) {
        if (e.metaKey || e.ctrlKey) {
            switch (e.key) {
                case "Enter": // Ctrl+Enter, Cmd+Enter
                    e.preventDefault();
                    run();
                    break;
                case "s": // Ctrl+S, Cmd+S
                    e.preventDefault();
                    save();
                    break;
                case "o": // Ctrl+O, Cmd+O
                    e.preventDefault();
                    open();
                    break;
                case "+": // Ctrl+Plus
                case "=": // Some layouts use '=' for '+'
                    e.preventDefault();
                    fontSize += 1;
                    setFontSizeForAllEditors(fontSize);
                    break;
                case "-": // Ctrl+Minus
                    e.preventDefault();
                    fontSize -= 1;
                    setFontSizeForAllEditors(fontSize);
                    break;
                case "0": // Ctrl+0
                    e.preventDefault();
                    fontSize = 13;
                    setFontSizeForAllEditors(fontSize);
                    break;
            }
        }
    });

    require(["vs/editor/editor.main"], function (ignorable) {
        
        layout = new GoldenLayout(layoutConfig, $("#judge0-site-content"));

        layout.registerComponent("source", function (container, state) {
            sourceEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: true,
                readOnly: state.readOnly,
                language: "cpp",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: true
                }
            });

            sourceEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);
        });

        layout.registerComponent("stdin", function (container, state) {
            stdinEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: false,
                readOnly: state.readOnly,
                language: "plaintext",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: false
                }
            });
        });

        layout.registerComponent("stdout", function (container, state) {
            stdoutEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: false,
                readOnly: state.readOnly,
                language: "plaintext",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: false
                }
            });
        });


        function markdownToHtml(markdownText) {
            // Convert headers (#, ##, ###, etc.)
            markdownText = markdownText.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
            markdownText = markdownText.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
            markdownText = markdownText.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
            markdownText = markdownText.replace(/^### (.*$)/gim, '<h3>$1</h3>');
            markdownText = markdownText.replace(/^## (.*$)/gim, '<h2>$1</h2>');
            markdownText = markdownText.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
            // Convert bold (** or __)
            markdownText = markdownText.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
            markdownText = markdownText.replace(/__(.*?)__/gim, '<strong>$1</strong>');
        
            // Convert italics (* or _)
            markdownText = markdownText.replace(/\*(.*?)\*/gim, '<em>$1</em>');
            markdownText = markdownText.replace(/_(.*?)_/gim, '<em>$1</em>');
        
            // Convert unordered lists (-, *, +)
            markdownText = markdownText.replace(/^\s*[-*+] (.*$)/gim, '<li>$1</li>');
            markdownText = markdownText.replace(/<li>(.*)<\/li>/gim, '<ul><li>$1</li></ul>');
        
            // Convert links ([text](url))
            markdownText = markdownText.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>');
        
            // Convert paragraphs (any text not wrapped in other tags)
            markdownText = markdownText.replace(/^(?!<[hlu])(.*?)$/gim, '<p>$1</p>');
        
            // Remove extra <ul> tags around single <li> elements
            markdownText = markdownText.replace(/<ul>(<li>.*<\/li>)<\/ul>/gim, '$1');
        
            return markdownText;
        }
        

        layout.registerComponent("chat", function (container, state){
            const chatContainer =document.createElement("div");
            chatContainer.className="chat-container h-full flex flex-col bg-[#1e1e1e]";
            chatContainer.innerHTML=`
        <div class="chat-header bg-[#252526] border-b border-[#3e3e42] p-4">
            <div class="chat-header-content space-y-1">
                <h3 class="chat-title text-lg font-semibold text-[#cccccc] flex items-center gap-2">
                    <svg class="w-5 h-5 text-[#0078d4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                    </svg>
                    Code Assistant
                </h3>
                <div class="flex items-center gap-2">
                    <input type="password"
                        id="openrouter-api-key"
                        class="flex-1 bg-[#1e1e1e] text-[#cccccc] text-sm rounded border border-[#3e3e42] px-2 py-1 focus:outline-none focus:border-[#0078d4]"
                        placeholder="Enter OpenRouter API Key"
                        value="${OPENROUTER_API_KEY}" />
                    <button 
                        id="save-api-key"
                        class="bg-[#0078d4] hover:bg-[#006bb3] text-white text-sm px-2 py-1 rounded transition-colors">
                        Save Key
                    </button>
                </div>
                <div class="flex items-center gap-2">
                    <input type="input"
                        id="openrouter-model-name"
                        class="flex-1 bg-[#1e1e1e] text-[#cccccc] text-sm rounded border border-[#3e3e42] px-2 py-1 focus:outline-none focus:border-[#0078d4]"
                        placeholder="Provide your model name here..."
                        value="${SELECTED_MODEL}" />
                    <button 
                        id="save-model"
                        class="bg-[#0078d4] hover:bg-[#006bb3] text-white text-sm px-2 py-1 rounded transition-colors">
                        Save Model
                    </button>
                </div>
                <p class="chat-description text-sm text-[#8a8a8a]">
                    Do you have any questions or need help with programming? Let me help you.
                </p>
            </div>
        </div>

        <!-- Scrollable messages area -->
        <div class="messages flex-1 overflow-y-auto p-4 space-y-4"></div>

        <!-- Chat input area stays fixed at the bottom -->
        <div class="chat-input-container border-t border-[#3e3e42] p-4 bg-[#252526] flex-shrink-0">
            <div class="chat-input-wrapper flex gap-2">
                <textarea 
                    class="chat-input flex-1 bg-[#1e1e1e] text-[#cccccc] rounded-lg border border-[#3e3e42] p-3 focus:outline-none focus:border-[#0078d4] resize-none"
                    rows="1"
                    placeholder="Ask about the code..."></textarea>

                <button class="send-btn bg-[#0078d4] hover:bg-[#006bb3] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors" title="Send message (Enter)">
                    <span>Send</span>
                   <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 2L11 13M22 2L15 22L11 13L2 9l20-7z"></path>
                        </svg>
                </button>
            </div>
        </div>
    `
            const messageEl=chatContainer.querySelector(".messages")
            const inputEl= chatContainer.querySelector("textarea")
            const sendBtn = chatContainer.querySelector(".send-btn")
            

            inputEl.addEventListener('input', function(){
                this.style.height='auto'
                this.style.height=Math.min(this.scrollHeight, 200)+'px'
            })

            function formatTimestamp(){
                const now= new Date()
                return now.toLocaleTimeString('en-US',{
                    hour:'numeric',
                    minutes:'2-digit',
                    hour12: true
                })

            }
            function addUserMessage(message){
                const messageHTML=`
                    <div class="message-wrapper user-message-wrapper flex justify-end">
                        <div class="message user-message bg-[#0078d4] text-[#ffffff] rounded-2xl rounded-tr-sm px-4 max-w-[80%]">
                            <div class="message-content">${markdownToHtml(message)}</div>
                            <div class="message-timestamp text-xs text-[#e6e6e6] mt-1">${formatTimestamp()}</div>
                        </div>
                    </div>      
                `
                messageEl.insertAdjacentHTML('beforeend',messageHTML)
                messageEl.scrollTop=messageEl.scrollHeight
            }

            function addAssistantMessage(message){
                const messageHTML=`
                    <div class="message-wrapper assistant-message-wrapper flex justify-start">
                        <div class="message assistant-message bg-[#252526] text-[#cccccc] rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
                            <div class="message-content">${markdownToHtml(message)}</div>
                            <div class="message-timestamp text-xs text-[#8a8a8a] mt-1">${formatTimestamp()}</div>
                        </div>
                    </div>      
                `
                messageEl.insertAdjacentHTML('beforeend',messageHTML)
                messageEl.scrollTop=messageEl.scrollHeight
            }

            function addTypingIndicator(){
                const indicatorHTML=`
                    <div class="message-wrapper assistant-message-wrapper flex justify-start" id="typing-indicator">
                        <div class="message assistant-message bg-[#252526] text-[#cccccc] rounded-2xl rounded-tl-sm px-4 py-2">
                            <div class="typing-indicator flex gap-1">
                                <div class="typing-dot w-2 h-2 bg-[#8a8a8a] rounded-full animate-bounce"></div>
                                <div class="typing-dot w-2 h-2 bg-[#8a8a8a] rounded-full animate-bounce" style="animation-delay:0.2s"></div>
                                <div class="typing-dot w-2 h-2 bg-[#8a8a8a] rounded-full animate-bounce" style="animation-delay:0.4s"></div>
                            </div>
                        </div>
                    </div>      
                `
                messageEl.insertAdjacentHTML('beforeend',indicatorHTML)
                messageEl.scrollTop=messageEl.scrollHeight
            }
            function removeTypingIndicator(){
                const indicator= messageEl.querySelector('#typing-indicator')
                if(indicator){
                    indicator.remove()
                }
            }

            async function sendMessage(){
                const message = inputEl.value.trim()
                if(!message) return 
                inputEl.value=''
                inputEl.style.height= 'auto'
                
                addUserMessage(message)
                addTypingIndicator()
                
                const codeContext={
                    source_code:sourceEditor.getValue(),
                    language: $selectLanguage.find(":selected").text(),
                    stdin: stdinEditor.getValue(),
                    stdout: stdoutEditor.getValue()
                }

                try{
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions',{
                    method: 'POST',
                    headers:{
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'HTTP-Referer' : window.location.origin,
                        'X-Title' : 'Judge0 IDE'
                    },
                    body: JSON.stringify({
                        model:SELECTED_MODEL,
                        messages:[{
                            role:'system',
                            content: `You are an expert programming assistant, You have access to the following code context:
                            Language:${codeContext.language}
                            Source Code :
                            \`\`\`
                            ${codeContext.source_code}
                            \`\`\`
                            ${codeContext.stdin ? `Input: \n${codeContext.stdin}\n` : ''}
                            ${codeContext.stdout ? `Output: \n${codeContext.stdout}\n` : ''}

                            Provide clear, concise, and accurate responses about the code. If suggesting code changes, explain the reasoning and ensure they follow best practices.`

                        },
                        {
                            role:'user',
                            content: `Here is the user's message: 
                            
                            <user_message>
                            ${message}
                            </user_message>

                            Provide a detailed and accurate response to the user's message based on the code context. If suggesting code changes, explain the reasoning and ensure they follow best practices.`
                        }]
                    })
                })

                if (!response.ok){
                    throw new Error(`API request failed: ${response.statusText}` )
                }
                
                const data = await response.json()
                const assistantMessage= data.choices[0].message.content 
                removeTypingIndicator()
                addAssistantMessage(assistantMessage)
            
        }
        catch (error){
            console.error('Error:', error)
            removeTypingIndicator()
            addAssistantMessage("Sorry, there was an error processing your request. Please make sure you have set up your Open Router API key correctly.")
        }
    }
            sendBtn.addEventListener("click",sendMessage)
            inputEl.addEventListener("keydown", (e) => {
                if( e.key=== "Enter" && !e.shiftKey){
                    e.preventDefault()
                    sendMessage()
                }
            })


            const apiKeyInput = chatContainer.querySelector("#openrouter-api-key")
            const saveKeyBtn= chatContainer.querySelector("#save-api-key")

            saveKeyBtn.addEventListener("click",() => {
                const newKey=apiKeyInput.value.trim()
                console.log("saved key")
                setOpenRouterApiKey(newKey)
                addAssistantMessage("API key has been saved.")
            })


            const modelInput = chatContainer.querySelector("#openrouter-model-name")
            const saveModelBtn= chatContainer.querySelector("#save-model")

            saveModelBtn.addEventListener("click",() => {
                const newModel=modelInput.value.trim()
                console.log("saved model")
                setSelectedModel(newModel)
                addAssistantMessage("Model "+newModel+"has been saved.")
            })
            container.getElement().append(chatContainer)
        
        } );

        layout.on("initialised", function () {
            setDefaults();
            refreshLayoutSize();
            window.top.postMessage({ event: "initialised" }, "*");
        });

        layout.init();
    });

    let superKey = "⌘";
    if (!/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
        superKey = "Ctrl";
    }

    [$runBtn].forEach(btn => {
        btn.attr("data-content", `${superKey}${btn.attr("data-content")}`);
    });

    document.querySelectorAll(".description").forEach(e => {
        e.innerText = `${superKey}${e.innerText}`;
    });

    if (PUTER) {
        puter.ui.onLaunchedWithItems(async function (items) {
            gPuterFile = items[0];
            openFile(await (await gPuterFile.read()).text(), gPuterFile.name);
        });
        applyMinimalStyleMode();
    }

    window.onmessage = function (e) {
        if (!e.data) {
            return;
        }

        if (e.data.action === "get") {
            window.top.postMessage(JSON.parse(JSON.stringify({
                event: "getResponse",
                source_code: sourceEditor.getValue(),
                language_id: getSelectedLanguageId(),
                flavor: getSelectedLanguageFlavor(),
                stdin: stdinEditor.getValue(),
                stdout: stdoutEditor.getValue(),
                compiler_options: $compilerOptions.val(),
                command_line_arguments: $commandLineArguments.val()
            })), "*");
        } else if (e.data.action === "set") {
            if (e.data.source_code) {
                sourceEditor.setValue(e.data.source_code);
            }
            if (e.data.language_id && e.data.flavor) {
                selectLanguageByFlavorAndId(e.data.language_id, e.data.flavor);
            }
            if (e.data.stdin) {
                stdinEditor.setValue(e.data.stdin);
            }
            if (e.data.stdout) {
                stdoutEditor.setValue(e.data.stdout);
            }
            if (e.data.compiler_options) {
                $compilerOptions.val(e.data.compiler_options);
            }
            if (e.data.command_line_arguments) {
                $commandLineArguments.val(e.data.command_line_arguments);
            }
            if (e.data.api_key) {
                AUTH_HEADERS["Authorization"] = `Bearer ${e.data.api_key}`;
            }
        }
    };
});

const DEFAULT_SOURCE = "\
#include <algorithm>\n\
#include <cstdint>\n\
#include <iostream>\n\
#include <limits>\n\
#include <set>\n\
#include <utility>\n\
#include <vector>\n\
\n\
using Vertex    = std::uint16_t;\n\
using Cost      = std::uint16_t;\n\
using Edge      = std::pair< Vertex, Cost >;\n\
using Graph     = std::vector< std::vector< Edge > >;\n\
using CostTable = std::vector< std::uint64_t >;\n\
\n\
constexpr auto kInfiniteCost{ std::numeric_limits< CostTable::value_type >::max() };\n\
\n\
auto dijkstra( Vertex const start, Vertex const end, Graph const & graph, CostTable & costTable )\n\
{\n\
    std::fill( costTable.begin(), costTable.end(), kInfiniteCost );\n\
    costTable[ start ] = 0;\n\
\n\
    std::set< std::pair< CostTable::value_type, Vertex > > minHeap;\n\
    minHeap.emplace( 0, start );\n\
\n\
    while ( !minHeap.empty() )\n\
    {\n\
        auto const vertexCost{ minHeap.begin()->first  };\n\
        auto const vertex    { minHeap.begin()->second };\n\
\n\
        minHeap.erase( minHeap.begin() );\n\
\n\
        if ( vertex == end )\n\
        {\n\
            break;\n\
        }\n\
\n\
        for ( auto const & neighbourEdge : graph[ vertex ] )\n\
        {\n\
            auto const & neighbour{ neighbourEdge.first };\n\
            auto const & cost{ neighbourEdge.second };\n\
\n\
            if ( costTable[ neighbour ] > vertexCost + cost )\n\
            {\n\
                minHeap.erase( { costTable[ neighbour ], neighbour } );\n\
                costTable[ neighbour ] = vertexCost + cost;\n\
                minHeap.emplace( costTable[ neighbour ], neighbour );\n\
            }\n\
        }\n\
    }\n\
\n\
    return costTable[ end ];\n\
}\n\
\n\
int main()\n\
{\n\
    constexpr std::uint16_t maxVertices{ 10000 };\n\
\n\
    Graph     graph    ( maxVertices );\n\
    CostTable costTable( maxVertices );\n\
\n\
    std::uint16_t testCases;\n\
    std::cin >> testCases;\n\
\n\
    while ( testCases-- > 0 )\n\
    {\n\
        for ( auto i{ 0 }; i < maxVertices; ++i )\n\
        {\n\
            graph[ i ].clear();\n\
        }\n\
\n\
        std::uint16_t numberOfVertices;\n\
        std::uint16_t numberOfEdges;\n\
\n\
        std::cin >> numberOfVertices >> numberOfEdges;\n\
\n\
        for ( auto i{ 0 }; i < numberOfEdges; ++i )\n\
        {\n\
            Vertex from;\n\
            Vertex to;\n\
            Cost   cost;\n\
\n\
            std::cin >> from >> to >> cost;\n\
            graph[ from ].emplace_back( to, cost );\n\
        }\n\
\n\
        Vertex start;\n\
        Vertex end;\n\
\n\
        std::cin >> start >> end;\n\
\n\
        auto const result{ dijkstra( start, end, graph, costTable ) };\n\
\n\
        if ( result == kInfiniteCost )\n\
        {\n\
            std::cout << \"NO\\n\";\n\
        }\n\
        else\n\
        {\n\
            std::cout << result << '\\n';\n\
        }\n\
    }\n\
\n\
    return 0;\n\
}\n\
";

const DEFAULT_STDIN = "\
3\n\
3 2\n\
1 2 5\n\
2 3 7\n\
1 3\n\
3 3\n\
1 2 4\n\
1 3 7\n\
2 3 1\n\
1 3\n\
3 1\n\
1 2 4\n\
1 3\n\
";

const DEFAULT_COMPILER_OPTIONS = "";
const DEFAULT_CMD_ARGUMENTS = "";
const DEFAULT_LANGUAGE_ID = 105; // C++ (GCC 14.1.0) (https://ce.judge0.com/languages/105)

function getEditorLanguageMode(languageName) {
    const DEFAULT_EDITOR_LANGUAGE_MODE = "plaintext";
    const LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE = {
        "Bash": "shell",
        "C": "c",
        "C3": "c",
        "C#": "csharp",
        "C++": "cpp",
        "Clojure": "clojure",
        "F#": "fsharp",
        "Go": "go",
        "Java": "java",
        "JavaScript": "javascript",
        "Kotlin": "kotlin",
        "Objective-C": "objective-c",
        "Pascal": "pascal",
        "Perl": "perl",
        "PHP": "php",
        "Python": "python",
        "R": "r",
        "Ruby": "ruby",
        "SQL": "sql",
        "Swift": "swift",
        "TypeScript": "typescript",
        "Visual Basic": "vb"
    }

    for (let key in LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE) {
        if (languageName.toLowerCase().startsWith(key.toLowerCase())) {
            return LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE[key];
        }
    }
    return DEFAULT_EDITOR_LANGUAGE_MODE;
}

const EXTENSIONS_TABLE = {
    "asm": { "flavor": CE, "language_id": 45 }, // Assembly (NASM 2.14.02)
    "c": { "flavor": CE, "language_id": 103 }, // C (GCC 14.1.0)
    "cpp": { "flavor": CE, "language_id": 105 }, // C++ (GCC 14.1.0)
    "cs": { "flavor": EXTRA_CE, "language_id": 29 }, // C# (.NET Core SDK 7.0.400)
    "go": { "flavor": CE, "language_id": 95 }, // Go (1.18.5)
    "java": { "flavor": CE, "language_id": 91 }, // Java (JDK 17.0.6)
    "js": { "flavor": CE, "language_id": 102 }, // JavaScript (Node.js 22.08.0)
    "lua": { "flavor": CE, "language_id": 64 }, // Lua (5.3.5)
    "pas": { "flavor": CE, "language_id": 67 }, // Pascal (FPC 3.0.4)
    "php": { "flavor": CE, "language_id": 98 }, // PHP (8.3.11)
    "py": { "flavor": EXTRA_CE, "language_id": 25 }, // Python for ML (3.11.2)
    "r": { "flavor": CE, "language_id": 99 }, // R (4.4.1)
    "rb": { "flavor": CE, "language_id": 72 }, // Ruby (2.7.0)
    "rs": { "flavor": CE, "language_id": 73 }, // Rust (1.40.0)
    "scala": { "flavor": CE, "language_id": 81 }, // Scala (2.13.2)
    "sh": { "flavor": CE, "language_id": 46 }, // Bash (5.0.0)
    "swift": { "flavor": CE, "language_id": 83 }, // Swift (5.2.3)
    "ts": { "flavor": CE, "language_id": 101 }, // TypeScript (5.6.2)
    "txt": { "flavor": CE, "language_id": 43 }, // Plain Text
};

function getLanguageForExtension(extension) {
    return EXTENSIONS_TABLE[extension] || { "flavor": CE, "language_id": 43 }; // Plain Text (https://ce.judge0.com/languages/43)
}
