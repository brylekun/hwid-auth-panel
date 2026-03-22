'use client';

import { useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  Copy,
  Globe2,
  Link2,
  MoreHorizontal,
  Pencil,
  Power,
  Trash2,
} from 'lucide-react';
import { formatDateTime, normalize } from './format';
import styles from './dashboard.module.css';
import type { WebLoaderRow } from './types';

type Props = {
  webLoaders: WebLoaderRow[];
  onWebLoaderCreated: (webLoader: WebLoaderRow) => void;
  onWebLoaderUpdated: (webLoader: WebLoaderRow) => void;
  onWebLoaderDeleted: (loaderId: string) => void;
  pushToast: (message: string, type?: 'success' | 'error') => void;
};

const PAGE_SIZE = 8;

function normalizeSlugInput(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export default function WebLoadersTable({
  webLoaders,
  onWebLoaderCreated,
  onWebLoaderUpdated,
  onWebLoaderDeleted,
  pushToast,
}: Props) {
  const [sortBy, setSortBy] = useState<'name' | 'slug' | 'status' | 'created_at'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDownloadUrl, setCreateDownloadUrl] = useState('');
  const [createStorageBucket, setCreateStorageBucket] = useState('');
  const [createStoragePath, setCreateStoragePath] = useState('');
  const [createExpectedSha256, setCreateExpectedSha256] = useState('');
  const [isCreateUploadBusy, setIsCreateUploadBusy] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [actionType, setActionType] = useState<'edit' | 'status' | 'delete' | null>(null);
  const [selected, setSelected] = useState<WebLoaderRow | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<WebLoaderRow | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftSlug, setDraftSlug] = useState('');
  const [draftDownloadUrl, setDraftDownloadUrl] = useState('');
  const [draftStorageBucket, setDraftStorageBucket] = useState('');
  const [draftStoragePath, setDraftStoragePath] = useState('');
  const [draftExpectedSha256, setDraftExpectedSha256] = useState('');
  const [isEditUploadBusy, setIsEditUploadBusy] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = normalize(query);

    return webLoaders.filter((loader) => {
      const statusMatch = statusFilter === 'all' || loader.status === statusFilter;
      if (!statusMatch) return false;
      if (!q) return true;

      return (
        normalize(loader.name).includes(q) ||
        normalize(loader.slug).includes(q) ||
        normalize(loader.download_url).includes(q) ||
        normalize(loader.expected_sha256 || '').includes(q)
      );
    });
  }, [webLoaders, query, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const left = String(a[sortBy] || '');
      const right = String(b[sortBy] || '');
      return sortDir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
    });
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function badgeClass(status: WebLoaderRow['status']) {
    return `${styles.badge} ${status === 'active' ? styles.active : styles.inactive}`;
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      pushToast(successMessage);
    } catch {
      pushToast('Failed to copy', 'error');
    }
  }

  function getEndpointPath(slug: string) {
    return `/api/auth/web-loader/${slug}`;
  }

  function getEndpoint(slug: string) {
    const endpointPath = getEndpointPath(slug);
    if (typeof window === 'undefined') {
      return endpointPath;
    }
    return `${window.location.origin}${endpointPath}`;
  }

  async function createWebLoader(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = createName.trim();
    const slug = normalizeSlugInput(createSlug);
    const downloadUrl = createDownloadUrl.trim();
    const storageBucket = createStorageBucket.trim();
    const storagePath = createStoragePath.trim();
    const expectedSha256 = createExpectedSha256.trim().toLowerCase();

    if (!name || !slug || !downloadUrl) {
      pushToast('Name, slug, and download URL are required', 'error');
      return;
    }

    if ((storageBucket && !storagePath) || (!storageBucket && storagePath)) {
      pushToast('Storage bucket/path must be set together', 'error');
      return;
    }

    if (expectedSha256 && !/^[a-f0-9]{64}$/.test(expectedSha256)) {
      pushToast('Expected SHA-256 must be 64 lowercase hex chars', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/create-web-loader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          loaderSlug: slug,
          downloadUrl,
          ...(storageBucket && storagePath
            ? {
                storageBucket,
                storagePath,
              }
            : {}),
          ...(expectedSha256
            ? {
                expectedSha256,
              }
            : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to create web loader', 'error');
        return;
      }

      onWebLoaderCreated(data.webLoader);
      setCreateName('');
      setCreateSlug('');
      setCreateDownloadUrl('');
      setCreateStorageBucket('');
      setCreateStoragePath('');
      setCreateExpectedSha256('');
      setPage(1);
      pushToast('Web loader created');
    } catch {
      pushToast('Network error while creating web loader', 'error');
    } finally {
      setIsCreating(false);
    }
  }

  async function uploadDllFile(file: File, mode: 'create' | 'edit') {
    if (!file.name.toLowerCase().endsWith('.dll')) {
      pushToast('Only .dll files are allowed', 'error');
      return;
    }

    const slugValue = mode === 'create' ? normalizeSlugInput(createSlug) : normalizeSlugInput(draftSlug);

    if (mode === 'create') {
      setIsCreateUploadBusy(true);
    } else {
      setIsEditUploadBusy(true);
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (slugValue) {
        formData.append('loaderSlug', slugValue);
      }

      const response = await fetch('/api/admin/upload-web-loader', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to upload DLL', 'error');
        return;
      }

      if (mode === 'create') {
        setCreateDownloadUrl(data.downloadUrl || '');
        setCreateStorageBucket(data.storageBucket || data.bucket || '');
        setCreateStoragePath(data.storagePath || data.filePath || '');
        setCreateExpectedSha256(data.expectedSha256 || '');
      } else {
        setDraftDownloadUrl(data.downloadUrl || '');
        setDraftStorageBucket(data.storageBucket || data.bucket || '');
        setDraftStoragePath(data.storagePath || data.filePath || '');
        setDraftExpectedSha256(data.expectedSha256 || '');
      }

      pushToast(
        data.previewDownloadUrl
          ? 'DLL uploaded. Session-signed URL is active.'
          : 'DLL uploaded. URL and SHA-256 filled.'
      );
    } catch {
      pushToast('Network error while uploading DLL', 'error');
    } finally {
      if (mode === 'create') {
        setIsCreateUploadBusy(false);
        if (createFileInputRef.current) {
          createFileInputRef.current.value = '';
        }
      } else {
        setIsEditUploadBusy(false);
        if (editFileInputRef.current) {
          editFileInputRef.current.value = '';
        }
      }
    }
  }

  async function updateWebLoader(
    loaderId: string,
    payload: {
      name?: string;
      loaderSlug?: string;
      downloadUrl?: string;
      storageBucket?: string | null;
      storagePath?: string | null;
      expectedSha256?: string | null;
      status?: 'active' | 'inactive';
    }
  ) {
    setBusyId(loaderId);

    try {
      const response = await fetch('/api/admin/update-web-loader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loaderId, ...payload }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to update web loader', 'error');
        return;
      }

      onWebLoaderUpdated(data.webLoader);
      pushToast('Web loader updated');
    } catch {
      pushToast('Network error while updating web loader', 'error');
    } finally {
      setBusyId('');
    }
  }

  async function deleteWebLoader(loaderId: string) {
    setBusyId(loaderId);

    try {
      const response = await fetch('/api/admin/delete-web-loader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loaderId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        pushToast(data.message || 'Failed to delete web loader', 'error');
        return;
      }

      onWebLoaderDeleted(loaderId);
      pushToast(data.message || 'Web loader deleted');
    } catch {
      pushToast('Network error while deleting web loader', 'error');
    } finally {
      setBusyId('');
    }
  }

  function openAction(type: 'edit' | 'status' | 'delete', loader: WebLoaderRow) {
    setActionType(type);
    setSelected(loader);
    setDraftName(loader.name);
    setDraftSlug(loader.slug);
    setDraftDownloadUrl(loader.download_url);
    setDraftStorageBucket(loader.storage_bucket || '');
    setDraftStoragePath(loader.storage_path || '');
    setDraftExpectedSha256(loader.expected_sha256 || '');
  }

  function closeAction() {
    if (busyId) return;
    setActionType(null);
    setSelected(null);
    setDraftName('');
    setDraftSlug('');
    setDraftDownloadUrl('');
    setDraftStorageBucket('');
    setDraftStoragePath('');
    setDraftExpectedSha256('');
  }

  async function confirmAction() {
    if (!selected || !actionType) return;

    if (actionType === 'edit') {
      const payload = {} as {
        name?: string;
        loaderSlug?: string;
        downloadUrl?: string;
        storageBucket?: string | null;
        storagePath?: string | null;
        expectedSha256?: string | null;
      };
      const nextName = draftName.trim();
      const nextSlug = normalizeSlugInput(draftSlug);
      const nextUrl = draftDownloadUrl.trim();
      const nextStorageBucket = draftStorageBucket.trim();
      const nextStoragePath = draftStoragePath.trim();
      const prevStorageBucket = (selected.storage_bucket || '').trim();
      const prevStoragePath = (selected.storage_path || '').trim();
      const nextExpectedSha256 = draftExpectedSha256.trim().toLowerCase();
      const prevExpectedSha256 = (selected.expected_sha256 || '').trim().toLowerCase();

      if (!nextName || !nextSlug || !nextUrl) {
        pushToast('Name, slug, and download URL are required', 'error');
        return;
      }

      if ((nextStorageBucket && !nextStoragePath) || (!nextStorageBucket && nextStoragePath)) {
        pushToast('Storage bucket/path must be set together', 'error');
        return;
      }

      if (nextExpectedSha256 && !/^[a-f0-9]{64}$/.test(nextExpectedSha256)) {
        pushToast('Expected SHA-256 must be 64 lowercase hex chars', 'error');
        return;
      }

      if (nextName !== selected.name) {
        payload.name = nextName;
      }

      if (nextSlug !== selected.slug) {
        payload.loaderSlug = nextSlug;
      }

      if (nextUrl !== selected.download_url) {
        payload.downloadUrl = nextUrl;
      }

      if (nextStorageBucket !== prevStorageBucket || nextStoragePath !== prevStoragePath) {
        if (nextStorageBucket && nextStoragePath) {
          payload.storageBucket = nextStorageBucket;
          payload.storagePath = nextStoragePath;
        } else {
          payload.storageBucket = null;
          payload.storagePath = null;
        }
      }

      if (nextExpectedSha256 !== prevExpectedSha256) {
        payload.expectedSha256 = nextExpectedSha256 || null;
      }

      if (
        !payload.name &&
        !payload.loaderSlug &&
        !payload.downloadUrl &&
        payload.storageBucket === undefined &&
        payload.storagePath === undefined &&
        payload.expectedSha256 === undefined
      ) {
        pushToast('No changes to save', 'error');
        return;
      }

      await updateWebLoader(selected.id, payload);
      closeAction();
      return;
    }

    if (actionType === 'status') {
      await updateWebLoader(selected.id, {
        status: selected.status === 'active' ? 'inactive' : 'active',
      });
      closeAction();
      return;
    }

    await deleteWebLoader(selected.id);
    closeAction();
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.panelEyebrow}>Secure delivery links</p>
          <h2 className={styles.sectionTitle}>Web Loaders</h2>
        </div>
        <div className={styles.sectionTools}>
          <span className={styles.metaPill}>{filtered.length} items</span>
        </div>
      </div>

      <form className={styles.formGrid} onSubmit={(event) => void createWebLoader(event)}>
        <input
          className={styles.input}
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
          placeholder="Loader name"
        />
        <input
          className={styles.input}
          value={createSlug}
          onChange={(event) => setCreateSlug(event.target.value)}
          placeholder="Slug"
        />
        <input
          className={styles.input}
          value={createDownloadUrl}
          onChange={(event) => {
            setCreateDownloadUrl(event.target.value);
            setCreateStorageBucket('');
            setCreateStoragePath('');
            setCreateExpectedSha256('');
          }}
          placeholder="https://example.com/loader.exe"
        />
        <input
          className={styles.input}
          value={createExpectedSha256}
          onChange={(event) => setCreateExpectedSha256(event.target.value.toLowerCase())}
          placeholder="Expected SHA-256 (optional)"
        />
        <button
          className={styles.btnGhost}
          type="button"
          onClick={() => createFileInputRef.current?.click()}
          disabled={isCreateUploadBusy || isCreating}
        >
          {isCreateUploadBusy ? 'Uploading DLL...' : 'Upload DLL'}
        </button>
        <input
          ref={createFileInputRef}
          className={styles.hiddenFileInput}
          type="file"
          accept=".dll,application/octet-stream"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void uploadDllFile(file, 'create');
          }}
        />
        <button className={styles.btn} type="submit" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create'}
        </button>
      </form>

      <div className={styles.controlRow}>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Search name, slug, URL"
          className={styles.input}
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as 'all' | 'active' | 'inactive');
            setPage(1);
          }}
          className={styles.select}
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className={styles.licenseToolsRow}>
        <select
          value={sortBy}
          onChange={(event) =>
            setSortBy(event.target.value as 'name' | 'slug' | 'status' | 'created_at')
          }
          className={styles.select}
        >
          <option value="created_at">Sort: Created</option>
          <option value="name">Sort: Name</option>
          <option value="slug">Sort: Slug</option>
          <option value="status">Sort: Status</option>
        </select>
        <select
          value={sortDir}
          onChange={(event) => setSortDir(event.target.value as 'asc' | 'desc')}
          className={styles.select}
        >
          <option value="desc">Direction: Desc</option>
          <option value="asc">Direction: Asc</option>
        </select>
      </div>

      {filtered.length === 0 ? <p className={styles.empty}>No web loaders found.</p> : null}

      <div className={styles.licenseCards}>
        {paged.map((loader) => (
          <article
            key={loader.id}
            className={styles.licenseCard}
            onClick={() => setSelectedDetails(loader)}
          >
            <div className={styles.licenseCardHead}>
              <div className={styles.licenseCardHeadLeft}>
                <span className={styles.badgeClassless}>Web Loader</span>
                <span className={badgeClass(loader.status)}>{loader.status}</span>
              </div>
              <button
                type="button"
                className={styles.licenseIconBtn}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedDetails(loader);
                }}
                aria-label="Open web loader details"
                title="Open web loader details"
              >
                <MoreHorizontal size={16} strokeWidth={2} />
              </button>
            </div>

            <div className={styles.licenseCardKey}>
              <div className={styles.licenseKeyRow}>
                <span className={styles.licenseKeyIcon}>
                  <Link2 size={16} strokeWidth={2} />
                </span>
                <span className={styles.hashValue}>{loader.slug}</span>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={(event) => {
                    event.stopPropagation();
                    void copyText(getEndpoint(loader.slug), 'Loader endpoint copied');
                  }}
                  title="Copy endpoint"
                  aria-label="Copy endpoint"
                >
                  <Copy size={14} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className={styles.licenseStatsGrid}>
              <div className={styles.licenseStatBox}>
                <span className={styles.licenseStatIcon}>
                  <Globe2 size={16} strokeWidth={2} />
                </span>
                <div>
                  <p className={styles.licenseStatLabel}>Name</p>
                  <p className={styles.licenseStatValue}>{loader.name}</p>
                </div>
              </div>

              <div className={styles.licenseStatBox}>
                <span className={styles.licenseStatIcon}>
                  <CalendarClock size={16} strokeWidth={2} />
                </span>
                <div>
                  <p className={styles.licenseStatLabel}>Created</p>
                  <p className={styles.licenseStatValue}>{formatDateTime(loader.created_at)}</p>
                </div>
              </div>
            </div>

            <div className={styles.licenseCardMeta}>
              <div className={styles.licenseCardMetaItem}>
                <p className={styles.mobileLabel}>Download URL:</p>
                <p className={styles.expiryInlineValue}>
                  {loader.storage_bucket && loader.storage_path
                    ? `Generated per auth request via ${getEndpointPath(loader.slug)}`
                    : loader.download_url}
                </p>
              </div>
              <div className={`${styles.licenseCardMetaItem} ${styles.shaMetaItem}`}>
                <div className={styles.shaMetaHeader}>
                  <p className={styles.mobileLabel}>Expected SHA-256:</p>
                  {loader.expected_sha256 ? (
                    <button
                      type="button"
                      className={`${styles.copyBtn} ${styles.shaCopyBtn}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void copyText(loader.expected_sha256 || '', 'Expected SHA-256 copied');
                      }}
                      title="Copy expected SHA-256"
                      aria-label="Copy expected SHA-256"
                    >
                      <Copy size={13} strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
                <p className={`${styles.expiryInlineValue} ${styles.shaMetaValue}`}>
                  {loader.expected_sha256 || 'Not set'}
                </p>
              </div>
            </div>

            <div className={styles.actionGroup} onClick={(event) => event.stopPropagation()}>
              <button
                className={`${styles.btnGhost} ${styles.licenseActionEdit}`}
                onClick={() => openAction('edit', loader)}
                disabled={busyId === loader.id}
                type="button"
              >
                <span className={styles.btnInline}>
                  <Pencil size={15} strokeWidth={2} />
                  Edit
                </span>
              </button>

              <button
                className={`${styles.btnGhost} ${
                  loader.status === 'active'
                    ? styles.licenseActionDeactivate
                    : styles.licenseActionActivate
                }`}
                onClick={() => openAction('status', loader)}
                disabled={busyId === loader.id}
                type="button"
              >
                <span className={styles.btnInline}>
                  <Power size={15} strokeWidth={2} />
                  {loader.status === 'active' ? 'Deactivate' : 'Activate'}
                </span>
              </button>

              <button
                className={styles.btnDanger}
                onClick={() => openAction('delete', loader)}
                disabled={busyId === loader.id}
                type="button"
              >
                <span className={styles.btnInline}>
                  <Trash2 size={15} strokeWidth={2} />
                  Delete
                </span>
              </button>
            </div>
          </article>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className={styles.pagination}>
          <button
            className={styles.btnGhost}
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            type="button"
          >
            Prev
          </button>
          <span>{safePage} / {totalPages}</span>
          <button
            className={styles.btnGhost}
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      ) : null}

      {selected && actionType ? (
        <div className={styles.modalOverlay} role="presentation" onClick={closeAction}>
          <div
            className={`${styles.modalCard} ${actionType === 'edit' ? styles.modalCardEdit : ''}`}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>
              {actionType === 'edit'
                ? 'Edit Web Loader'
                : actionType === 'status'
                  ? selected.status === 'active'
                    ? 'Deactivate Web Loader'
                    : 'Activate Web Loader'
                  : 'Delete Web Loader'}
            </h3>

            {actionType === 'edit' ? (
              <div className={styles.modalBody}>
                <p className={styles.modalText}>Update name, slug, and download URL.</p>
                <input
                  className={styles.input}
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Loader name"
                  autoFocus
                />
                <input
                  className={styles.input}
                  value={draftSlug}
                  onChange={(event) => setDraftSlug(event.target.value)}
                  placeholder="slug"
                />
                <input
                  className={styles.input}
                  value={draftDownloadUrl}
                  onChange={(event) => {
                    setDraftDownloadUrl(event.target.value);
                    setDraftStorageBucket('');
                    setDraftStoragePath('');
                    setDraftExpectedSha256('');
                  }}
                  placeholder="https://example.com/loader.exe"
                />
                <input
                  className={styles.input}
                  value={draftExpectedSha256}
                  onChange={(event) => setDraftExpectedSha256(event.target.value.toLowerCase())}
                  placeholder="Expected SHA-256 (optional)"
                />
                <button
                  className={styles.btnGhost}
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={isEditUploadBusy || Boolean(busyId)}
                >
                  {isEditUploadBusy ? 'Uploading DLL...' : 'Upload DLL'}
                </button>
                <input
                  ref={editFileInputRef}
                  className={styles.hiddenFileInput}
                  type="file"
                  accept=".dll,application/octet-stream"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void uploadDllFile(file, 'edit');
                  }}
                />
              </div>
            ) : (
              <p className={styles.modalText}>
                {actionType === 'status'
                  ? `Are you sure you want to ${selected.status === 'active' ? 'deactivate' : 'activate'} this web loader?`
                  : 'Are you sure you want to delete this web loader? This cannot be undone.'}
              </p>
            )}

            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={closeAction} disabled={Boolean(busyId)} type="button">
                Cancel
              </button>
              <button
                className={actionType === 'delete' ? styles.btnDanger : styles.btn}
                onClick={() => void confirmAction()}
                disabled={Boolean(busyId)}
                type="button"
              >
                {busyId
                  ? 'Processing...'
                  : actionType === 'edit'
                    ? 'Save'
                    : actionType === 'status'
                      ? selected.status === 'active'
                        ? 'Deactivate'
                        : 'Activate'
                      : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedDetails ? (
        <>
          <div className={styles.drawerOverlay} onClick={() => setSelectedDetails(null)} />
          <aside className={styles.drawerPanel}>
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitle}>Web Loader Details</h3>
              <button className={styles.btnGhost} onClick={() => setSelectedDetails(null)} type="button">
                Close
              </button>
            </div>

            <div className={styles.drawerGrid}>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Name</p>
                <p className={styles.drawerValue}>{selectedDetails.name}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Slug</p>
                <p className={styles.drawerValue}>{selectedDetails.slug}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Status</p>
                <p className={styles.drawerValue}>{selectedDetails.status}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Created At</p>
                <p className={styles.drawerValue}>{formatDateTime(selectedDetails.created_at)}</p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Download URL</p>
                <p className={styles.drawerValue}>
                  {selectedDetails.storage_bucket && selectedDetails.storage_path
                    ? `Generated per auth request via ${getEndpointPath(selectedDetails.slug)}`
                    : selectedDetails.download_url}
                </p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>Storage Object</p>
                <p className={styles.drawerValue}>
                  {selectedDetails.storage_bucket && selectedDetails.storage_path
                    ? `${selectedDetails.storage_bucket}/${selectedDetails.storage_path}`
                    : 'External URL mode'}
                </p>
              </div>
              {selectedDetails.storage_bucket && selectedDetails.storage_path ? (
                <div className={styles.drawerItem}>
                  <p className={styles.drawerLabel}>Stored Fallback URL</p>
                  <p className={styles.drawerValue}>{selectedDetails.download_url}</p>
                </div>
              ) : null}
              <div className={styles.drawerItem}>
                <div className={styles.shaMetaHeader}>
                  <p className={styles.drawerLabel}>Expected SHA-256</p>
                  {selectedDetails.expected_sha256 ? (
                    <button
                      type="button"
                      className={`${styles.copyBtn} ${styles.shaCopyBtn}`}
                      onClick={() =>
                        void copyText(selectedDetails.expected_sha256 || '', 'Expected SHA-256 copied')
                      }
                      title="Copy expected SHA-256"
                      aria-label="Copy expected SHA-256"
                    >
                      <Copy size={13} strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
                <p className={`${styles.drawerValue} ${styles.shaDrawerValue}`}>
                  {selectedDetails.expected_sha256 || 'Not set'}
                </p>
              </div>
              <div className={styles.drawerItem}>
                <p className={styles.drawerLabel}>API Endpoint</p>
                <p className={styles.drawerValue}>{getEndpointPath(selectedDetails.slug)}</p>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </section>
  );
}


