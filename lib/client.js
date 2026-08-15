window.__ModuleLoader__.load({
	id: "dsh-wiki-bridge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		/** 设置页样式（独立注入）。 */
		const CSS = ".wikibridge-settings{display:flex;flex-direction:column;gap:12px;padding:4px;max-width:560px}.wb-row{display:flex;align-items:center;gap:8px}.wb-row label{min-width:110px;flex:none;opacity:.85}.wb-input{flex:1;min-width:0}.wb-actions{display:flex;gap:8px;margin-top:4px}.wb-msg{opacity:.75;font-size:12px;white-space:pre-wrap}.wb-hint{opacity:.6;font-size:12px}";
		const CSS_ID = "dsh-wiki-bridge/settings.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-wiki-bridge";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/** 插件私有配置通道：Host 自注册的 HTTP 路由（不依赖 settings allowlist）。 */
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

		const inject = ["slots"];

		/**
		 * 设置页组件：通过插件私有 HTTP 通道读写持久化配置（settings.yaml）。
		 */
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
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
