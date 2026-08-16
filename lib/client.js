window.__ModuleLoader__.load({
	id: "dsh-wiki-bridge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		/** 插件样式（设置页 + Wiki 阅读视图）。 */
		const CSS = ".wikibridge-settings{display:flex;flex-direction:column;gap:12px;padding:4px;max-width:560px}.wb-row{display:flex;align-items:center;gap:8px}.wb-row label{min-width:110px;flex:none;opacity:.85}.wb-input{flex:1;min-width:0}.wb-actions{display:flex;gap:8px;margin-top:4px}.wb-msg{opacity:.75;font-size:12px;white-space:pre-wrap}.wb-hint{opacity:.6;font-size:12px}" +
			".wiki-view{display:flex;flex-direction:column;height:100%;min-height:0}.wiki-toolbar{display:flex;gap:8px;padding:10px;align-items:center;flex:none}.wiki-toolbar input{flex:1;min-width:0;height:32px;padding:0 12px;border-radius:16px;border:1px solid rgba(128,128,128,.3);background:transparent;color:inherit;font-size:13px}.wiki-body{display:flex;flex:1;min-height:0;border-top:1px solid rgba(128,128,128,.15)}" +
			".wiki-list{width:230px;flex:none;overflow-y:auto;padding:8px}.wiki-group-title{font-size:11px;opacity:.55;padding:6px 8px 2px;letter-spacing:.5px}.wiki-item{display:block;width:100%;text-align:left;padding:5px 8px;border:none;background:none;cursor:pointer;font-size:13px;border-radius:6px;color:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wiki-item:hover{background:rgba(128,128,128,.12)}.wiki-item.active{background:rgba(128,128,128,.22)}" +
			".wiki-content{flex:1;overflow-y:auto;padding:16px 22px;min-width:0}.wiki-content h1{font-size:20px;margin:0 0 14px}.wiki-content h2{font-size:16px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid rgba(128,128,128,.15)}.wiki-content h3{font-size:14px;margin:12px 0 6px}.wiki-content h4,.wiki-content h5,.wiki-content h6{font-size:13px;margin:10px 0 5px}.wiki-content p{margin:6px 0;line-height:1.65}.wiki-content ul{margin:4px 0 10px 20px;padding:0}.wiki-content li{margin:2px 0}.wiki-content pre{background:rgba(128,128,128,.12);padding:10px 12px;border-radius:6px;overflow-x:auto;font-size:12px;line-height:1.5}.wiki-content blockquote{margin:8px 0;padding:2px 12px;border-left:3px solid rgba(128,128,128,.3);opacity:.8}.wb-code{background:rgba(128,128,128,.15);padding:1px 5px;border-radius:4px;font-size:12px}.wb-link{text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer}.wiki-empty{opacity:.5;padding:32px;text-align:center;font-size:13px}";
		const CSS_ID = "dsh-wiki-bridge/styles.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-wiki-bridge";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/** 插件私有 HTTP 通道（不依赖 settings allowlist）。 */
		const API = "/api/wiki-bridge/config";

		async function apiGet() {
			const res = await fetch(API);
			if (!res.ok) throw new Error("GET " + API + " → HTTP " + res.status);
			const data = await res.json();
			if (!data.ok) throw new Error(String(data.error || "unknown"));
			return data.config;
		}

		async function apiPost(payload) {
			const res = await fetch(API, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || data.ok === false) throw new Error(String((data && data.error) || ("HTTP " + res.status)));
			return data;
		}

		async function browseNotes() {
			const res = await fetch("/api/wiki-bridge/browse");
			const data = await res.json();
			if (!data.ok) throw new Error(String(data.error || "browse 失败"));
			return data.notes;
		}

		async function readNote(path) {
			const res = await fetch("/api/wiki-bridge/note?path=" + encodeURIComponent(path));
			const data = await res.json();
			if (!data.ok) throw new Error(String(data.error || "读取失败"));
			return data.content;
		}

		const inject = ["slots"];

		// ---------- 轻量 markdown 渲染（无第三方库） ----------
		function stripFrontmatter(text) {
			if (typeof text !== "string" || !text.startsWith("---")) return text || "";
			const end = text.indexOf("\n---", 3);
			if (end === -1) return text;
			return text.slice(end + 5).replace(/^\n+/, "");
		}

		function renderInline(text, keyBase) {
			const parts = [];
			const re = /(`[^`]+`|\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g;
			let last = 0;
			let k = 0;
			for (const m of text.matchAll(re)) {
				if (m.index > last) parts.push(text.slice(last, m.index));
				const tok = m[0];
				if (tok.startsWith("`")) parts.push(react.createElement("code", { key: keyBase + "-" + (k++), className: "wb-code" }, tok.slice(1, -1)));
				else if (tok.startsWith("**")) parts.push(react.createElement("strong", { key: keyBase + "-" + (k++) }, tok.slice(2, -2)));
				else {
					const inner = tok.slice(2, -2);
					const label = inner.includes("|") ? inner.split("|")[1] : inner;
					parts.push(react.createElement("span", { key: keyBase + "-" + (k++), className: "wb-link" }, label));
				}
				last = m.index + tok.length;
			}
			if (last < text.length) parts.push(text.slice(last));
			return parts;
		}

		function renderMd(text) {
			const lines = stripFrontmatter(text).split("\n");
			const out = [];
			let inCode = false;
			let codeBuf = [];
			let listBuf = [];
			let key = 0;
			const flushList = () => {
				if (!listBuf.length) return;
				out.push(react.createElement("ul", { key: "ul-" + (key++) }, listBuf.map((item, i) => react.createElement("li", { key: i }, renderInline(item, "li-" + i)))));
				listBuf = [];
			};
			for (const line of lines) {
				if (line.trim().startsWith("```")) {
					if (inCode) {
						out.push(react.createElement("pre", { key: "pre-" + (key++) }, codeBuf.join("\n")));
						codeBuf = [];
						inCode = false;
					} else {
						flushList();
						inCode = true;
					}
					continue;
				}
				if (inCode) { codeBuf.push(line); continue; }
				const h = line.match(/^(#{1,6})\s+(.*)$/);
				if (h) {
					flushList();
					const level = h[1].length;
					const tag = level <= 6 ? "h" + level : "h6";
					out.push(react.createElement(tag, { key: "h-" + (key++) }, renderInline(h[2], "h-" + key)));
					continue;
				}
				if (/^[-*]\s+/.test(line)) { listBuf.push(line.replace(/^[-*]\s+/, "")); continue; }
				if (/^>\s?/.test(line)) {
					flushList();
					out.push(react.createElement("blockquote", { key: "q-" + (key++) }, renderInline(line.replace(/^>\s?/, ""), "q-" + key)));
					continue;
				}
				flushList();
				if (line.trim() === "") continue;
				out.push(react.createElement("p", { key: "p-" + (key++) }, renderInline(line, "p-" + key)));
			}
			flushList();
			if (inCode && codeBuf.length) out.push(react.createElement("pre", { key: "pre-" + (key++) }, codeBuf.join("\n")));
			return out;
		}

		// ---------- Wiki 阅读视图（会话内标签页） ----------
		function WikiView() {
			const [notes, setNotes] = react.useState(null);
			const [query, setQuery] = react.useState("");
			const [current, setCurrent] = react.useState(null);
			const [error, setError] = react.useState("");

			const load = () => {
				setError("");
				browseNotes().then((list) => setNotes(list)).catch((e) => setError(String((e && e.message) || e)));
			};
			react.useEffect(load, []);

			const open = (path) => {
				setError("");
				readNote(path).then((content) => setCurrent({ path, content })).catch((e) => setError(String((e && e.message) || e)));
			};

			const filtered = (notes || []).filter((n) => {
				const q = query.trim().toLowerCase();
				if (!q) return true;
				return (n.title + " " + n.path + " " + (n.tags || []).join(" ")).toLowerCase().includes(q);
			});
			const groups = {};
			for (const n of filtered) {
				const cat = n.path.includes("/") ? n.path.split("/")[0] : "根目录";
				(groups[cat] = groups[cat] || []).push(n);
			}

			return react.createElement("div", { className: "wiki-view" },
				react.createElement("div", { className: "wiki-toolbar" },
					react.createElement("input", { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "搜索笔记…" }),
					react.createElement("button", { onClick: load }, "刷新")),
				react.createElement("div", { className: "wiki-body" },
					react.createElement("div", { className: "wiki-list" },
						!notes ? react.createElement("div", { className: "wiki-empty" }, "加载中…") :
							Object.keys(groups).length === 0 ? react.createElement("div", { className: "wiki-empty" }, "无匹配笔记") :
								Object.keys(groups).sort().map((cat) => react.createElement("div", { key: cat, className: "wiki-group" },
									react.createElement("div", { className: "wiki-group-title" }, "📁 " + cat),
									groups[cat].map((n) => react.createElement("button", {
										key: n.path,
										className: "wiki-item" + (current && current.path === n.path ? " active" : ""),
										onClick: () => open(n.path),
									}, n.title))))),
					react.createElement("div", { className: "wiki-content" },
						error ? react.createElement("div", { className: "wiki-empty" }, "出错了：" + error) :
							current ? renderMd(current.content) :
								react.createElement("div", { className: "wiki-empty" }, "← 选择左侧笔记开始阅读"))));
		}

		// ---------- 设置页 ----------
		function WikiSettings() {
			const [vaultPath, setVaultPath] = react.useState("");
			const [vaultName, setVaultName] = react.useState("");
			const [autoIndex, setAutoIndex] = react.useState(true);
			const [confirmWrite, setConfirmWrite] = react.useState(true);
			const [autoDict, setAutoDict] = react.useState(true);
			const [decayDays, setDecayDays] = react.useState("90");
			const [msg, setMsg] = react.useState("");
			const [busy, setBusy] = react.useState(false);

			react.useEffect(() => {
				let alive = true;
				apiGet().then((cfg) => {
					if (!alive) return;
					if (typeof cfg.vaultPath === "string") setVaultPath(cfg.vaultPath);
					if (typeof cfg.vaultName === "string") setVaultName(cfg.vaultName);
					if (typeof cfg.autoIndex === "boolean") setAutoIndex(cfg.autoIndex);
					if (typeof cfg.confirmWrite === "boolean") setConfirmWrite(cfg.confirmWrite);
					if (typeof cfg.autoDict === "boolean") setAutoDict(cfg.autoDict);
					if (typeof cfg.decayDays === "number") setDecayDays(String(cfg.decayDays));
				}).catch((e) => { if (alive) setMsg("读取配置失败： " + String((e && e.message) || e)); });
				return () => { alive = false; };
			}, []);

			const save = () => {
				setBusy(true); setMsg("");
				apiPost({ op: "set", patch: { vaultPath, vaultName, autoIndex, confirmWrite, autoDict, decayDays: Number(decayDays) || 90 } })
					.then(() => setMsg("已保存（settings.yaml 持久化，立即生效）"))
					.catch((e) => setMsg("保存失败：" + String((e && e.message) || e)))
					.finally(() => setBusy(false));
			};

			const rediscover = () => {
				setBusy(true); setMsg("");
				apiPost({ op: "discover" })
					.then((r) => {
						if (r.config && typeof r.config.vaultPath === "string") setVaultPath(r.config.vaultPath);
						if (r.config && typeof r.config.vaultName === "string") setVaultName(r.config.vaultName);
						setMsg(r.discovered ? "已自动发现并回填 vault" : "未发现 vault：请手动填写路径后保存");
					})
					.catch((e) => setMsg("自动发现失败：" + String((e && e.message) || e)))
					.finally(() => setBusy(false));
			};

			return react.createElement("div", { className: "wikibridge-settings" },
				react.createElement("h3", null, "WikiBridge — Obsidian 知识库桥接"),
				react.createElement("div", { className: "wb-hint" }, "把 DSH 会话与你的 Obsidian vault 桥接：对话中的知识按 _约定.md 规范沉淀进收件箱，随时可查。配置持久化保存，重启后依然生效。"),
				react.createElement("div", { className: "wb-row" },
					react.createElement("label", null, "Vault 路径"),
					react.createElement("input", { className: "wb-input", value: vaultPath, onChange: (e) => setVaultPath(e.target.value), placeholder: "/home/you/Documents/Obsidian Vault" })),
				react.createElement("div", { className: "wb-row" },
					react.createElement("label", null, "Vault 名称"),
					react.createElement("input", { className: "wb-input", value: vaultName, onChange: (e) => setVaultName(e.target.value), placeholder: "默认取目录名" })),
				react.createElement("div", { className: "wb-row" },
					react.createElement("label", null, "写入确认"),
					react.createElement("input", { type: "checkbox", checked: confirmWrite, onChange: (e) => setConfirmWrite(e.target.checked) }),
					react.createElement("span", { className: "wb-hint" }, "每次 wiki_write 前向你确认")),
				react.createElement("div", { className: "wb-row" },
					react.createElement("label", null, "常驻指引"),
					react.createElement("input", { type: "checkbox", checked: autoIndex, onChange: (e) => setAutoIndex(e.target.checked) }),
					react.createElement("span", { className: "wb-hint" }, "在系统提示中注入知识库使用指引")),
				react.createElement("div", { className: "wb-row" },
					react.createElement("label", null, "自动词典检索"),
					react.createElement("input", { type: "checkbox", checked: autoDict, onChange: (e) => setAutoDict(e.target.checked) }),
					react.createElement("span", { className: "wb-hint" }, "对话命中知识库主题词时自动注入相关笔记摘要（闲聊零开销）")),
				react.createElement("div", { className: "wb-row" },
					react.createElement("label", null, "过时阈值（天）"),
					react.createElement("input", { className: "wb-input", value: decayDays, onChange: (e) => setDecayDays(e.target.value), placeholder: "90" }),
					react.createElement("span", { className: "wb-hint" }, "updated 超过该天数未更新 → 体检报告可能过时（遗忘检测）")),
				react.createElement("div", { className: "wb-actions" },
					react.createElement("button", { onClick: rediscover, disabled: busy }, "自动发现"),
					react.createElement("button", { onClick: save, disabled: busy }, "保存")),
				msg ? react.createElement("div", { className: "wb-msg" }, msg) : null);
		}

		function apply(ctx) {
			const slots = ctx.get("slots");
			if (!slots) return;
			slots.inject("settings.section", () => slots.register(
				{ name: "settings.section", id: "wiki-bridge", order: 50, label: () => "WikiBridge" },
				() => react.createElement(WikiSettings)
			));
			slots.inject("conversation.view", () => slots.register(
				{ name: "conversation.view", id: "wiki-bridge-view", order: 20, label: () => "Wiki" },
				() => react.createElement(WikiView)
			));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
