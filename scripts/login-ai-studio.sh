#!/bin/bash
PROFILE_DIR="${HOME}/.openmausbot/browser/profiles/ai-studio"
mkdir -p "${PROFILE_DIR}"

echo "Đang mở Google Chrome với hồ sơ dự án RoMes..."
echo "Hồ sơ lưu tại: ${PROFILE_DIR}"
echo "Hãy đăng nhập tài khoản Google của bạn một lần duy nhất. Sau khi đăng nhập xong, bạn có thể đóng cửa sổ hoặc để đó."

google-chrome \
  --user-data-dir="${PROFILE_DIR}" \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --disable-blink-features=AutomationControlled \
  "https://aistudio.google.com/prompts/new_chat?model=gemini-nano-banana-2.1" >/dev/null 2>&1 &

echo "Đã mở Chrome (PID: $!). Bạn có thể đăng nhập trên cửa sổ Chrome vừa xuất hiện."
