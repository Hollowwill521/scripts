#!/bin/bash

# =================================================================
# TeleBox Pro 部署助手 V3.0 (交互登录增强版)
# 特性：支持多步验证码输入、Ctrl+C 防中断、智能多开
# =================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CURRENT_USER=$(whoami)
USER_GROUP=$(id -gn)
NODE_VERSION="20"

# --- 1. 环境检查 ---
check_environment() {
    clear
    echo -e "${BLUE}[系统环境检查]${NC}"
    # 智能 Swap
    if [[ $(free -m | grep Swap | awk '{print $2}') -lt 1000 ]]; then
        echo -e "${YELLOW}检测到内存较小，自动创建虚拟内存...${NC}"
        sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile &>/dev/null
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab &>/dev/null
    fi
    # 基础软件
    sudo apt update -q
    sudo apt install -y git python3 python3-pip build-essential curl jq &>/dev/null
    # Node.js 20
    if ! node -v 2>/dev/null | grep -q "v$NODE_VERSION"; then
        echo -e "${YELLOW}安装 Node.js $NODE_VERSION...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    # PM2
    if ! command -v pm2 &> /dev/null; then
        echo -e "安装 PM2..."
        sudo npm install -g pm2
        pm2 install pm2-logrotate &>/dev/null
    fi
}

# --- 2. 智能计算下一个机器人 ---
detect_next_instance() {
    local count=1
    while true; do
        if [[ -d "/home/$CURRENT_USER/telebox$count" ]] || pm2 list | grep -q "telebox$count"; then
            ((count++))
        else
            NEXT_NAME="telebox$count"
            NEXT_PORT=$((8080 + count - 1))
            break
        fi
    done
}

# ======================= 主程序 =======================

detect_next_instance
echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}    TeleBox 部署助手 V3.0 (Userbot版)    ${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "建议配置: 名称 [ ${YELLOW}$NEXT_NAME${NC} ]  端口 [ ${YELLOW}$NEXT_PORT${NC} ]"
echo -e "-----------------------------------------"
echo -e "1. 全新安装 (Userbot 登录，需填 API ID)"
echo -e "2. 恢复备份 (已有 config.json)"
echo -e "3. 退出"
read -p "请选择: " MODE
if [[ "$MODE" == "3" ]]; then exit 0; fi

check_environment

# --- 配置路径 ---
echo -e "\n${YELLOW}>>> 实例配置 <<<${NC}"
read -p "确认机器人名称 (默认 $NEXT_NAME): " INPUT_NAME
BOX_NAME=${INPUT_NAME:-$NEXT_NAME}
INSTALL_PATH="/home/$CURRENT_USER/$BOX_NAME"

# 清理旧数据
if [[ -d "$INSTALL_PATH" ]]; then
    read -p "目录已存在，是否删除重装? (y/n): " DEL_CONFIRM
    [[ "$DEL_CONFIRM" == "y" ]] && pm2 delete "$BOX_NAME" &>/dev/null && rm -rf "$INSTALL_PATH" || exit 1
fi

# --- 拉取代码 ---
echo -e "\n${YELLOW}>>> 拉取代码... <<<${NC}"
git clone https://github.com/TeleBoxOrg/TeleBox.git "$INSTALL_PATH"
sudo chown -R $CURRENT_USER:$USER_GROUP "$INSTALL_PATH"
cd "$INSTALL_PATH"

# --- 处理 Config ---
if [[ "$MODE" == "1" ]]; then
    echo -e "\n${YELLOW}>>> 填写配置 <<<${NC}"
    [[ -f "config.example.json" ]] && cp config.example.json config.json || echo '{}' > config.json
    
    echo -e "${GREEN}请在编辑器中填入 api_id 和 api_hash。${NC}"
    echo -e "${GREEN}bot_token 请留空 (Userbot 稍后会输手机号)。${NC}"
    read -p "按回车打开编辑器..."
    nano config.json
    
    read -p "确认端口号 (默认 $NEXT_PORT): " INPUT_PORT
    PORT=${INPUT_PORT:-$NEXT_PORT}

elif [[ "$MODE" == "2" ]]; then
    echo -e "\n${YELLOW}>>> 恢复备份 <<<${NC}"
    read -p "请输入备份路径: " BACKUP_PATH
    cp -f "$BACKUP_PATH/config.json" "$INSTALL_PATH/"
    CONF_PORT=$(grep -oE '"port": *[0-9]+' config.json | awk -F: '{print $2}' | tr -d ' ,')
    PORT=${CONF_PORT:-$NEXT_PORT}
fi

# 生成 ecosystem
cat > ecosystem.config.js <<EOF
module.exports = {
  apps : [{
    name: "$BOX_NAME",
    script: "npm",
    args: "run start",
    cwd: "$INSTALL_PATH",
    env: { NODE_ENV: "production", PORT: $PORT },
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

# --- 安装依赖 ---
echo -e "\n${YELLOW}>>> 安装依赖 <<<${NC}"
rm -rf package-lock.json node_modules
npm install --silent
pip3 install rlottie-python Pillow --break-system-packages --quiet

# --- 关键：交互式登录保护逻辑 ---
if [[ "$MODE" == "1" ]]; then
    echo -e "\n${BLUE}=================================================${NC}"
    echo -e "${YELLOW}   ⚠️  Userbot 登录环节 (请仔细阅读)   ${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo -e "1. 脚本将启动 TeleBox，你需要根据屏幕提示操作。"
    echo -e "2. 依次输入：${GREEN}手机号${NC} -> ${GREEN}验证码${NC} -> ${GREEN}二步密码${NC}。"
    echo -e "3. 当看到 ${GREEN}'Successfully logged in'${NC} 后..."
    echo -e "   👉 请按下 ${RED}Ctrl + C${NC} 停止。"
    echo -e "4. **不用担心**，脚本会自动捕捉信号并转入后台！"
    echo -e "${BLUE}=================================================${NC}"
    read -p "准备好了吗？按回车开始登录..."

    # 【核心修改】捕捉 SIGINT 信号，防止脚本被 Ctrl+C 杀掉
    # 这样你按 Ctrl+C 只是杀掉了 npm start，但脚本本身会继续执行后面的代码
    trap 'echo -e "\n${GREEN}>>> 捕捉到退出信号，登录阶段结束。正在转入后台...${NC}"' SIGINT
    
    # 启动交互
    npm run start
    
    # 解除捕捉，恢复正常
    trap - SIGINT
fi

# --- 启动后台 ---
echo -e "\n${YELLOW}>>> 启动 PM2 后台进程 <<<${NC}"
pm2 start ecosystem.config.js
pm2 save
STARTUP_CMD=$(pm2 startup systemd -u $CURRENT_USER --hp /home/$CURRENT_USER | grep "sudo env")
[[ -n "$STARTUP_CMD" ]] && eval "$STARTUP_CMD"
pm2 save

echo -e "\n${GREEN}✅ 部署成功！${NC}"
echo -e "实例: $BOX_NAME | 端口: $PORT"
pm2 list | grep "$BOX_NAME"
