import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { localGetAll, localPut, localDelete, kvGet, kvSet } from '../../lib/db';
import { api } from '../../lib/apiClient';
import { completeChat } from '../../lib/ai';

interface Project {
  docId: string;
  name: string;
  createdAt: number;
  gh?: { repo: string; branch: string };
}
interface ProjectFile {
  docId: string;
  projectId: string;
  name: string;
  content: string;
  lang: string;
  updatedAt: number;
  gh?: { path: string };
}
interface Repo {
  name: string;
  full_name: string;
  default_branch: string;
}
interface AiPort {
  _id: string;
  nickname: string;
  name: string;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

export default function ICodePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [curProject, setCurProject] = useState<string>('');
  const [curFile, setCurFile] = useState<ProjectFile | null>(null);

  const [projName, setProjName] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [lang, setLang] = useState('txt');

  // AI 改写
  const [ports, setPorts] = useState<AiPort[]>([]);
  const [selPort, setSelPort] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  // GitHub
  const [ghToken, setGhToken] = useState('');
  const [ghRepos, setGhRepos] = useState<Repo[]>([]);
  const [ghMsg, setGhMsg] = useState('');
  const [pushMsg, setPushMsg] = useState('');

  useEffect(() => {
    loadProjects();
    kvGet<string>('ghToken').then((t) => t && setGhToken(t));
    api<{ configs: AiPort[] }>('/api/ai/configs').then((r) => {
      setPorts(r.configs);
      if (r.configs[0]) setSelPort(r.configs[0]._id);
    }).catch(() => {});
  }, []);

  async function loadProjects() {
    const rows = await localGetAll('projects');
    const list = rows.map((r) => r.data as unknown as Project).sort((a, b) => b.createdAt - a.createdAt);
    setProjects(list);
    if (list.length && !curProject) selectProject(list[0].docId);
  }

  async function selectProject(id: string) {
    setCurProject(id);
    const rows = await localGetAll('projectFiles');
    setFiles(rows.map((r) => r.data as unknown as ProjectFile).filter((f) => f.projectId === id));
    setCurFile(null);
    setFileContent('');
  }

  async function addProject() {
    if (!projName.trim()) return;
    const p: Project = { docId: uid(), name: projName.trim(), createdAt: Date.now() };
    await localPut('projects', p.docId, p as unknown as Record<string, unknown>);
    setProjName('');
    loadProjects();
  }

  async function addFile() {
    if (!fileName.trim() || !curProject) return;
    const f: ProjectFile = { docId: uid(), projectId: curProject, name: fileName.trim(), content: '', lang, updatedAt: Date.now() };
    await localPut('projectFiles', f.docId, f as unknown as Record<string, unknown>);
    setFileName('');
    selectProject(curProject);
  }

  async function saveFile() {
    if (!curFile) return;
    const updated = { ...curFile, content: fileContent, lang, updatedAt: Date.now() };
    await localPut('projectFiles', curFile.docId, updated as unknown as Record<string, unknown>);
    setCurFile(updated);
  }

  async function delFile(id: string) {
    await localDelete('projectFiles', id);
    selectProject(curProject);
  }

  async function openFile(f: ProjectFile) {
    setCurFile(f);
    setFileContent(f.content);
    setLang(f.lang);
  }

  // ── GitHub（PAT 仅存本地 kv，不进同步/备份）──
  async function saveGh() {
    await kvSet('ghToken', ghToken);
    setGhMsg('已保存（仅本机）');
  }
  async function listRepos() {
    setGhMsg('加载中…');
    try {
      const r = await fetch('https://api.github.com/user/repos?per_page=50', {
        headers: { Authorization: `Bearer ${ghToken}` },
      });
      if (!r.ok) throw new Error('GitHub ' + r.status);
      const data = (await r.json()) as Repo[];
      setGhRepos(data);
      setGhMsg(`共 ${data.length} 个仓库`);
    } catch (e) {
      setGhMsg((e as Error).message);
    }
  }
  async function importRepo(full: string, branch: string) {
    const p: Project = { docId: uid(), name: `GH·${full}`, createdAt: Date.now(), gh: { repo: full, branch } };
    await localPut('projects', p.docId, p as unknown as Record<string, unknown>);
    // 抓默认分支根目录文件清单元数据（内容不拉，推回时再取 sha）
    try {
      const r = await fetch(`https://api.github.com/repos/${full}/git/trees/${branch}?recursive=0`, {
        headers: { Authorization: `Bearer ${ghToken}` },
      });
      const tree = (await r.json()) as any;
      for (const item of tree.tree || []) {
        if (item.type === 'blob') {
          const f: ProjectFile = { docId: uid(), projectId: p.docId, name: item.path, content: '', lang: 'txt', updatedAt: Date.now(), gh: { path: item.path } };
          await localPut('projectFiles', f.docId, f as unknown as Record<string, unknown>);
        }
      }
    } catch {
      /* 忽略树拉取失败，仍建空项目 */
    }
    loadProjects();
  }

  // AI 读写：以指令改写当前文件内容
  async function aiRewrite() {
    if (!curFile) return;
    if (!selPort) return setAiBusy(false), setPushMsg('请先选择 AI 端口');
    setAiBusy(true);
    try {
      const out = await completeChat({
        configId: selPort,
        messages: [
          { role: 'system', content: `你是一个代码/文本协作助手。按用户指令修改下面给出的文件内容，只输出修改后的完整内容，不要解释、不要包裹代码块。` },
          { role: 'user', content: `文件：${curFile.name}\n指令：${aiPrompt || '润色/优化'}\n\n==== 原文 ====\n${fileContent}` },
        ],
        temperature: 0.3,
        maxTokens: 4000,
      });
      setFileContent(out.trim());
      setPushMsg('AI 已改写（保存后生效）');
    } catch (e) {
      setPushMsg((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  // 一键推回 GitHub：把该项目所有已关联路径的文件 PUT 回仓库
  async function pushToGh(project: Project) {    if (!project.gh) return setPushMsg('该项目未关联 GitHub（仅导入的仓库可推回）');
    const token = await kvGet<string>('ghToken');
    if (!token) return setPushMsg('先填写 GitHub PAT 并保存');
    setPushMsg('推回中…');
    const rows = (await localGetAll('projectFiles')).map((r) => r.data as unknown as ProjectFile);
    const fs = rows.filter((f) => f.projectId === project.docId && f.gh?.path);
    let ok = 0;
    for (const f of fs) {
      try {
        const url = `https://api.github.com/repos/${project.gh.repo}/contents/${f.gh!.path}`;
        const head = await fetch(`${url}?ref=${project.gh.branch}`, { headers: { Authorization: `Bearer ${token}` } });
        let sha: string | undefined;
        if (head.ok) sha = (await head.json()).sha;
        const body: Record<string, unknown> = {
          message: `update ${f.name} via InternalBeyond`,
          content: b64(f.content || ''),
          branch: project.gh.branch,
        };
        if (sha) body.sha = sha;
        const put = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!put.ok) {
          const e = (await put.json().catch(() => ({}))) as any;
          setPushMsg(`推回失败 ${f.name}: ${e.message || put.status}`);
          return;
        }
        ok++;
      } catch (e) {
        setPushMsg((e as Error).message);
        return;
      }
    }
    setPushMsg(`已推回 ${ok} 个文件到 ${project.gh.repo}`);
  }

  const curProj = projects.find((p) => p.docId === curProject);

  return (
    <div className="page">
      <SectionTitle en="ICode" cn="文件工作区" />
      <p className="hint">你与 AI 共用的文件工作区：项目分组、文件读写。GitHub 分区用 PAT 直连（令牌仅存本机、不进备份）。</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* 项目 + 文件 */}
        <GlassCard>
          <SectionTitle en="Projects" cn="项目" />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input className="fld" value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="新项目名" style={{ flex: 1 }} />
            <button className="btn primary" onClick={addProject}>＋</button>
          </div>
          {projects.map((p) => (
            <div key={p.docId} className="li" onClick={() => selectProject(p.docId)} style={{ marginBottom: 6, borderColor: p.docId === curProject ? 'var(--acc)' : undefined }}>
              <div className="li-main"><div className="li-name">{p.name}</div></div>
              {p.gh && <button className="btn" onClick={(e) => { e.stopPropagation(); pushToGh(p); }}>推回</button>}
            </div>
          ))}

          <SectionTitle en="Files" cn="文件" />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input className="fld" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="文件名" style={{ flex: 1 }} />
            <select className="fld" value={lang} onChange={(e) => setLang(e.target.value)}>
              {['txt', 'md', 'js', 'ts', 'json', 'html', 'css', 'py', 'sh'].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <button className="btn primary" onClick={addFile} disabled={!curProject}>＋</button>
          </div>
          {files.map((f) => (
            <div key={f.docId} className="li" onClick={() => openFile(f)} style={{ marginBottom: 6 }}>
              <div className="li-main"><div className="li-name">{f.name}</div></div>
              <button className="btn danger" onClick={(e) => { e.stopPropagation(); delFile(f.docId); }}>×</button>
            </div>
          ))}
        </GlassCard>

        {/* 编辑器 */}
        <GlassCard>
          <SectionTitle en="Editor" cn={curFile ? curFile.name : '编辑器'} />
          {curFile ? (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <select value={selPort} onChange={(e) => setSelPort(e.target.value)} className="fld" style={{ flex: 1 }}>
                  {ports.map((p) => <option key={p._id} value={p._id}>{p.nickname || p.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input className="fld" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="AI 指令（如：加注释/重构/修正 bug）" style={{ flex: 1 }} />
                <button className="btn" disabled={aiBusy} onClick={aiRewrite}>AI 改写</button>
              </div>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={14}
                style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: 10, background: 'var(--panel)', color: 'var(--tx)', fontFamily: 'var(--monoP)', fontSize: '0.8rem' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn primary" onClick={saveFile}>保存</button>
                {curProj?.gh && <button className="btn" onClick={() => pushToGh(curProj!)}>一键推回 GitHub</button>}
              </div>
              {pushMsg && <p className="muted" style={{ marginTop: 6 }}>{pushMsg}</p>}
            </>
          ) : (
            <Empty text="选择左侧文件开始编辑" />
          )}
        </GlassCard>
      </div>

      {/* GitHub 分区 */}
      <SectionTitle en="GitHub" cn="GitHub 分区" />
      <GlassCard>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="password" className="fld" value={ghToken} onChange={(e) => setGhToken(e.target.value)} placeholder="GitHub PAT" style={{ flex: 1 }} />
          <button className="btn" onClick={saveGh}>保存</button>
          <button className="btn" onClick={listRepos}>列仓库</button>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>{ghMsg}</div>
        <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
          {ghRepos.map((r) => (
            <div key={r.full_name} className="li" style={{ marginBottom: 6 }}>
              <div className="li-main"><div className="li-name">{r.full_name}</div></div>
              <button className="btn" onClick={() => importRepo(r.full_name, r.default_branch)}>导入</button>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
