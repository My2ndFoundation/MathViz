import type { Messages } from "./en";

/** 外壳的中文文案；键与 en.ts 完全相同（类型 Messages + tests/unit/i18n.test.ts 运行时比对）。 */
export const zh: Messages = {
  app: {
    loading: "加载中…",
  },
  nav: {
    search: "搜索工具",
    collapse: "收起侧栏",
    expand: "展开侧栏",
    notes: "笔记",
    askLibrary: "问整个库",
    settings: "设置",
  },
  settings: {
    language: "语言",
    langEn: "English",
    langZh: "中文",
  },
  content: {
    none: "还没有安装内容包。",
    version: "内容版本 {version}",
  },
  tool: {
    notFound: "已安装的内容包里没有这个工具。",
  },
  error: {
    bad_host: "请求不是从本应用的地址发出的。",
    bad_origin: "请求来自其他网站。",
    cross_site: "请求来自其他网站。",
    bad_csrf: "页面会话已过期，请刷新页面后重试。",
    method_not_allowed: "这里不允许这个操作。",
    body_too_large: "请求太大了。",
    bad_json: "无法读取请求内容。",
    bad_request: "请求无效。",
    not_found: "没有找到。",
    read_only: "这份数据由更新版本的应用写入，只能读，不能改。",
    not_ready: "应用还在启动，请稍后再试。",
    internal: "出错了。",
  },
};
