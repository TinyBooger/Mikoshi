import React, { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { AuthContext } from "../../components/AuthProvider";

const ISSUE_THANK_YOU_TEMPLATE = {
  title: "🎉 感谢您提交问题反馈",
  body: "感谢您向语伴岛提交问题报告！我们已收到您的反馈，并会认真跟进。\n\n感谢您帮助我们改进语伴岛，特为您送上以下礼物 🎁\n\n感谢您的支持！",
};

const PRO_REWARDS = [
  { amount: 1, label: "1个月" },
  { amount: 3, label: "3个月" },
  { amount: 6, label: "6个月" },
  { amount: 12, label: "1年" },
];
const CREDIT_REWARDS = [100, 500, 1000, 2000, 8000, 15000];

export default function UserMessagesPage() {
  const { sessionToken } = useContext(AuthContext);
  const location = useLocation();
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(location.state?.recipient || null);
  const [users, setUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [template, setTemplate] = useState(location.state?.reportId ? "issue-thanks" : "custom");
  const [title, setTitle] = useState(location.state?.reportId ? ISSUE_THANK_YOU_TEMPLATE.title : "");
  const [body, setBody] = useState(location.state?.reportId ? ISSUE_THANK_YOU_TEMPLATE.body : "");
  const [rewardType, setRewardType] = useState("");
  const [rewardAmount, setRewardAmount] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedRewardText = rewardType === "pro"
    ? `Pro 会员 ${PRO_REWARDS.find((item) => item.amount === rewardAmount)?.label}`
    : rewardType === "credits"
      ? `${rewardAmount?.toLocaleString()} 点数`
      : "";
  const composedMessage = template === "issue-thanks" && selectedRewardText
    ? `${body.trim()}\n\n🎁：${selectedRewardText}`
    : body.trim();

  useEffect(() => {
    const term = recipientSearch.trim();
    if (term.length < 2) {
      setUsers([]);
      setSearching(false);
      setSearchError("");
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const params = new URLSearchParams({
          search: term,
          page: "1",
          page_size: "10",
          sort_by: "name",
          sort_dir: "asc",
        });
        const response = await fetch(`${window.API_BASE_URL}/api/admin/users?${params}`, {
          headers: { Authorization: sessionToken },
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "Could not search users.");
        }
        const data = await response.json();
        if (!cancelled) setUsers(data.items || []);
      } catch (error) {
        if (!cancelled) {
          setUsers([]);
          setSearchError(error.message || "Could not search users.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipientSearch, sessionToken]);

  const handleTemplateChange = (event) => {
    const nextTemplate = event.target.value;
    setTemplate(nextTemplate);
    setSuccessMessage("");
    setSendError("");
    if (nextTemplate === "issue-thanks") {
      setTitle(ISSUE_THANK_YOU_TEMPLATE.title);
      setBody(ISSUE_THANK_YOU_TEMPLATE.body);
      setRewardType("");
      setRewardAmount(null);
    } else {
      setTitle("");
      setBody("");
      setRewardType("");
      setRewardAmount(null);
    }
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!selectedUser) {
      setSendError("Select a recipient before sending.");
      return;
    }
    if (template === "issue-thanks" && (!rewardType || !rewardAmount)) {
      setSendError("Select a thank-you reward before sending.");
      return;
    }
    setSending(true);
    setSendError("");
    setSuccessMessage("");
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/admin/messages/send`, {
        method: "POST",
        headers: {
          Authorization: sessionToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          msg_type: "system",
          title: title.trim(),
          body: composedMessage,
          reward: template === "issue-thanks"
            ? { type: rewardType, amount: rewardAmount }
            : null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Message could not be sent.");
      }
      const rewardLabel = template === "issue-thanks"
        ? rewardType === "pro"
          ? `，已赠送 ${PRO_REWARDS.find((item) => item.amount === rewardAmount)?.label} Pro 会员 🎁`
          : `，已赠送 ${rewardAmount.toLocaleString()} 点数 🎁`
        : "";
      setSuccessMessage(
        `Message sent to ${selectedUser.name || selectedUser.email || selectedUser.id}${rewardLabel}。`
      );
    } catch (error) {
      setSendError(error.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container-fluid">
      <h2 className="mb-1">Send User Message</h2>
      <p className="text-muted mb-4">
        Send a private inbox message to one user. Choose a template or write a custom message.
      </p>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSend}>
            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="recipient-search">Recipient</label>
              {selectedUser ? (
                <div className="d-flex align-items-center justify-content-between gap-3 border rounded p-3">
                  <div>
                    <div className="fw-semibold">{selectedUser.name || "Unnamed user"}</div>
                    <div className="small text-muted">{selectedUser.email || selectedUser.id}</div>
                    <div className="small text-muted">ID: {selectedUser.id}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setSelectedUser(null);
                      setSuccessMessage("");
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="recipient-search"
                    type="search"
                    className="form-control"
                    autoComplete="off"
                    placeholder="Search by user ID, name, email, or phone"
                    value={recipientSearch}
                    onChange={(event) => {
                      setRecipientSearch(event.target.value);
                      setUsers([]);
                    }}
                  />
                  <div className="form-text">Enter at least 2 characters to search.</div>
                  {searching && <div className="small text-muted mt-2">Searching users…</div>}
                  {searchError && <div className="alert alert-danger mt-2 mb-0">{searchError}</div>}
                  {!searching && !searchError && recipientSearch.trim().length >= 2 && users.length === 0 && (
                    <div className="small text-muted mt-2">No matching users found.</div>
                  )}
                  {users.length > 0 && (
                    <div className="list-group mt-2">
                      {users.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="list-group-item list-group-item-action text-start"
                          onClick={() => {
                            setSelectedUser(user);
                            setRecipientSearch("");
                            setUsers([]);
                            setSuccessMessage("");
                          }}
                        >
                          <span className="fw-semibold">{user.name || "Unnamed user"}</span>
                          <span className="small text-muted d-block">{user.email || user.id}</span>
                          <span className="small text-muted">ID: {user.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="message-template">Template</label>
              <select
                id="message-template"
                className="form-select"
                value={template}
                onChange={handleTemplateChange}
              >
                <option value="custom">Custom message</option>
                <option value="issue-thanks">Thank you for an issue report — credits/Pro gift</option>
              </select>
              {template === "issue-thanks" && (
                <div className="card border-primary-subtle mb-3">
                  <div className="card-body">
                    <h6 className="card-title">🎁 Thank-you gift</h6>
                    <div className="mb-3">
                      <div className="form-label small fw-semibold">✨ Pro 会员</div>
                      <div className="d-flex flex-wrap gap-2">
                        {PRO_REWARDS.map((option) => (
                          <button
                            key={option.amount}
                            type="button"
                            className={`btn btn-sm ${rewardType === "pro" && rewardAmount === option.amount ? "btn-success" : "btn-outline-success"}`}
                            aria-pressed={rewardType === "pro" && rewardAmount === option.amount}
                            onClick={() => {
                              setRewardType("pro");
                              setRewardAmount(option.amount);
                              setSendError("");
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="form-label small fw-semibold">💎 点数</div>
                      <div className="d-flex flex-wrap gap-2">
                        {CREDIT_REWARDS.map((credits) => (
                          <button
                            key={credits}
                            type="button"
                            className={`btn btn-sm ${rewardType === "credits" && rewardAmount === credits ? "btn-primary" : "btn-outline-primary"}`}
                            aria-pressed={rewardType === "credits" && rewardAmount === credits}
                            onClick={() => {
                              setRewardType("credits");
                              setRewardAmount(credits);
                              setSendError("");
                            }}
                          >
                            {credits.toLocaleString()} 点数
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-text mt-3">
                      Selecting a gift grants it when the message is sent. Pro rewards use the same calendar-month extension behavior as the User panel.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="message-title">Title</label>
              <input
                id="message-title"
                type="text"
                className="form-control"
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="message-body">Message</label>
              <textarea
                id="message-body"
                className="form-control"
                rows={7}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
              />
            </div>

            {template === "issue-thanks" && (
              <div className="card bg-light mb-3">
                <div className="card-header fw-semibold">Message preview</div>
                <div className="card-body" style={{ whiteSpace: "pre-wrap" }}>
                  {composedMessage || <span className="text-muted">Enter a message to preview it.</span>}
                </div>
              </div>
            )}

            {sendError && <div className="alert alert-danger" role="alert">{sendError}</div>}
            {successMessage && <div className="alert alert-success" role="status">{successMessage}</div>}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || !selectedUser || !title.trim() || !body.trim() ||
                (template === "issue-thanks" && (!rewardType || !rewardAmount))}
            >
              {sending ? (
                <><span className="spinner-border spinner-border-sm me-2" role="status" />Sending…</>
              ) : (
                <><i className="bi bi-send me-2" />Send Message</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
