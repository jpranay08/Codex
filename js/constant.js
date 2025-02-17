export const API_KEY = ""; // Get yours at https://platform.sulu.sh/apis/judge0

export const AUTH_HEADERS = API_KEY
    ? { "Authorization": `Bearer ${API_KEY}` }
    : {};

export const CE = "CE";
export const EXTRA_CE = "EXTRA_CE";

export const AUTHENTICATED_CE_BASE_URL = "https://judge0-ce.p.sulu.sh";
export const AUTHENTICATED_EXTRA_CE_BASE_URL = "https://judge0-extra-ce.p.sulu.sh";

export const AUTHENTICATED_BASE_URL = {
    [CE]: AUTHENTICATED_CE_BASE_URL,
    [EXTRA_CE]: AUTHENTICATED_EXTRA_CE_BASE_URL
};

export const UNAUTHENTICATED_CE_BASE_URL = "https://ce.judge0.com";
export const UNAUTHENTICATED_EXTRA_CE_BASE_URL = "https://extra-ce.judge0.com";

export const UNAUTHENTICATED_BASE_URL = {
    [CE]: UNAUTHENTICATED_CE_BASE_URL,
    [EXTRA_CE]: UNAUTHENTICATED_EXTRA_CE_BASE_URL
};

export const INITIAL_WAIT_TIME_MS = 0;
export const WAIT_TIME_FUNCTION = i => 100;
export const MAX_PROBE_REQUESTS = 50;

export var fontSize = 13;

export var layout;

export var sourceEditor;
export var stdinEditor;
export var stdoutEditor;

export var $selectLanguage;
export var $compilerOptions;
export var $commandLineArguments;
export var $runBtn;
export var $statusLine;

export var timeStart;
export var timeEnd;

export var sqliteAdditionalFiles;
export var languages = {};

export const PUTER = puter.env === "app";
export var gPuterFile;




// import {
//     API_KEY,
//     AUTH_HEADERS,
//     CE,
//     EXTRA_CE,
//     AUTHENTICATED_CE_BASE_URL,
//     AUTHENTICATED_EXTRA_CE_BASE_URL,
//     AUTHENTICATED_BASE_URL,
//     UNAUTHENTICATED_CE_BASE_URL,
//     UNAUTHENTICATED_EXTRA_CE_BASE_URL,
//     UNAUTHENTICATED_BASE_URL,
//     INITIAL_WAIT_TIME_MS,
//     WAIT_TIME_FUNCTION,
//     MAX_PROBE_REQUESTS,
//     fontSize,
//     layout,
//     sourceEditor,
//     stdinEditor,
//     stdoutEditor,
//     $selectLanguage,
//     $compilerOptions,
//     $commandLineArguments,
//     $runBtn,
//     $statusLine,
//     timeStart,
//     timeEnd,
//     sqliteAdditionalFiles,
//     languages,
//     PUTER,
//     gPuterFile
// } from "./constants.js";
