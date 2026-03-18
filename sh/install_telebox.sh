#!/bin/bash
# 下载脚本，赋予权限，并运行
#使用此链接安装wget -O install.sh https://raw.githubusercontent.com/Hollowwill521/scripts/refs/heads/main/sh/install_telebox.sh && chmod +x install.sh && ./install.sh
# =================================================================
# TeleBox Pro 部署助手 V4.0 (终极雷达防冲突版)
# 特性：自动避让占用端口/目录、支持多步验证码、Ctrl+C 防中断
# =================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CURRENT_USER=$(whoami)
USER_GROUP=$(id -gn)
NODE_VERSION="20"

# --- 1. 环境检查与治理 ---
check_environment() {
    clear
    echo -e "${BLUE}[系统环境检查]${NC}"
    # 智能 Swap (内存不足 1G 自动扩容，防止编译中断)
    if [[ $(free -m | grep Swap | awk '{print $2}') -lt 1000 ]]; then
        echo -e "${YELLOW}检测到内存较小，自动创建虚拟内存...${NC}"
        sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile &>/dev/null
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab &>/dev/null
    fi
    
    # 基础软件
    sudo apt update -q
    sudo apt install -y git python3 python3-pip build-essential curl jq iproute2 &>/dev/null
    
    # Node.js 20 强制保障
    if ! node -v 2>/dev/null | grep -q "v$NODE_VERSION"; then
        echo -e "${YELLOW}正在安装 Node.js $NODE_VERSION...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
    
    # PM2 守护进程
    if ! command -v pm2 &> /dev/null; then
        echo -e "正在安装 PM2..."
        sudo npm install -g pm2
        pm2 install pm2-logrotate &>/dev/null
    fi
}

# --- 2. 终极雷达探测 (核心防冲突逻辑) ---
detect_next_instance() {
    # 雷达 1：扫描安全目录与进程名
    local count=1
    while true; do
        if [[ -d "/home/$CURRENT_USER/telebox$count" ]] || pm2 list | grep -q "telebox$count"; then
            ((count++))
        else
            NEXT_NAME="telebox$count"
            break
        fi
    done

    # 雷达 2：深度嗅探系统空闲端口 (避开所有暗中运行的程序)
    NEXT_PORT=8080
    while true; do
        # 使用 ss 命令向 Linux 内核查询端口占用情况
        if ss -tuln | grep -q ":$NEXT_PORT " ; then
            ((NEXT_PORT++))
        else
            break
        fi
    done
}

# ======================= 主程序 =======================

check_environment
detect_next_instance

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}    TeleBox 部署助手 V4.0 (防冲突版)     ${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "雷达探测完毕，为您规划的绝对安全配置："
echo -e "  目录/进程名: [ ${YELLOW}$NEXT_NAME${NC} ]"
echo -e "  空闲独立端口: [ ${YELLOW}$NEXT_PORT${NC} ]"
echo -e "-----------------------------------------"
echo -e "1. 全新安装 (Userbot 登录，需填 API ID)"
echo -e "2. 恢复备份 (已有 config.json)"
echo -e "3. 退出"
read -p "请选择: " MODE
if [[ "$MODE" == "3" ]]; then exit 0; fi

# --- 配置路径 ---
echo -e "\n${YELLOW}>>> 实例配置确认 <<<${NC}"
read -p "确认机器人名称 (默认 $NEXT_NAME): " INPUT_NAME
BOX_NAME=${INPUT_NAME:-$NEXT_NAME}
INSTALL_PATH="/home/$CURRENT_USER/$BOX_NAME"

if [[ -d "$INSTALL_PATH" ]]; then
    read -p "目录已存在，是否删除重装? (y/n): " DEL_CONFIRM
    [[ "$DEL_CONFIRM" == "y" ]] && pm2 delete "$BOX_NAME" &>/dev/null && rm -rf "$INSTALL_PATH" || exit 1
fi

# --- 拉取代码 ---
echo -e "\n${YELLOW}>>> 拉取最新代码... <<<${NC}"
git clone https://github.com/TeleBoxOrg/TeleBox.git "$INSTALL_PATH"
sudo chown -R $CURRENT_USER:$USER_GROUP "$INSTALL_PATH"
cd "$INSTALL_PATH"

# --- 处理 Config ---
if [[ "$MODE" == "1" ]]; then
    echo -e "\n${YELLOW}>>> 填写配置 <<<${NC}"
    [[ -f "config.example.json" ]] && cp config.example.json config.json || echo '{}' > config.json
    
    echo -e "${GREEN}即将打开编辑器，请填入 api_id 和 api_hash。${NC}"
    echo -e "${GREEN}bot_token 请留空 (Userbot 稍后会输手机号)。${NC}"
    read -p "按回车打开编辑器..."
    nano config.json
    
    read -p "确认端口号 (雷达建议 $NEXT_PORT): " INPUT_PORT
    PORT=${INPUT_PORT:-$NEXT_PORT}

elif [[ "$MODE" == "2" ]]; then
    echo -e "\n${YELLOW}>>> 恢复备份 <<<${NC}"
    read -p "请输入备份路径: " BACKUP_PATH
    cp -f "$BACKUP_PATH/config.json" "$INSTALL_PATH/"
    CONF_PORT=$(grep -oE '"port": *[0-9]+' config.json | awk -F: '{print $2}' | tr -d ' ,')
    PORT=${CONF_PORT:-$NEXT_PORT}
fi

# 生成 PM2 Ecosystem
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
echo -e "\n${YELLOW}>>> 安装项目依赖 <<<${NC}"
rm -rf package-lock.json node_modules
npm install --silent
pip3 install rlottie-python Pillow --break-system-packages --quiet

# --- 交互式登录保护逻辑 (仅限全新安装) ---
if [[ "$MODE" == "1" ]]; then
    echo -e "\n${BLUE}=================================================${NC}"
    echo -e "${YELLOW}   ⚠️  Userbot 登录环节 (请仔细阅读)   ${NC}"
    echo -e "${BLUE}=================================================${NC}"
    echo -e "1. 依次输入：${GREEN}手机号${NC} -> ${GREEN}验证码${NC} -> ${GREEN}二步密码${NC}。"
    echo -e "2. 当看到 ${GREEN}'Successfully logged in'${NC} 后..."
    echo -e "   👉 请按下 ${RED}Ctrl + C${NC} 停止前台运行。"
    echo -e "3. 脚本将自动接管并转入 PM2 后台守护模式！"
    echo -e "${BLUE}=================================================${NC}"
    read -p "准备好了吗？按回车开始..."

    # 捕捉 SIGINT (Ctrl+C) 信号，保护主脚本不被杀死
    trap 'echo -e "\n${GREEN}>>> 捕捉到退出信号。正在无缝转入后台守护模式...${NC}"' SIGINT
    
    npm run start
    
    # 解除捕捉
    trap - SIGINT
fi

# --- 启动后台与固化 ---
echo -e "\n${YELLOW}>>> 启动 PM2 后台进程 <<<${NC}"
pm2 start ecosystem.config.js
pm2 save
# 自动提取并执行开机自启命令
STARTUP_CMD=$(pm2 startup systemd -u $CURRENT_USER --hp /home/$CURRENT_USER | grep "sudo env")
[[ -n "$STARTUP_CMD" ]] && eval "$STARTUP_CMD"
pm2 save

echo -e "\n${GREEN}✅ 部署彻底完成！${NC}"
echo -e "当前实例: [ $BOX_NAME ] | 运行端口: [ $PORT ]"
pm2 list | grep "$BOX_NAME"
