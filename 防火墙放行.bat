@echo off
chcp 65001 >nul
echo ============================================
echo  我的财务台 - 手机/平板访问放行脚本
echo  请在弹出窗口点"是"(UAC) 允许管理员运行
echo ============================================
echo.

rem 删除旧规则后重新添加，覆盖 专用/公用/域 三种网络
netsh advfirewall firewall delete rule name="FinanceApp Node Dev" >nul 2>&1
netsh advfirewall firewall add rule name="FinanceApp Node Dev" dir=in action=allow program="C:\Users\AMANBOL\AppData\Local\Programs\node-portable\node-v24.20.0-win-x64\node.exe" profile=any enable=yes
netsh advfirewall firewall delete rule name="FinanceApp Port 4173-4174" >nul 2>&1
netsh advfirewall firewall add rule name="FinanceApp Port 4173-4174" dir=in action=allow protocol=TCP localport=4173,4174 profile=any enable=yes

echo.
echo 完成！手机请访问:  http://192.168.1.172:4174/?v=42#/
echo 需与电脑连接同一个 WiFi。
echo 若仍打不开：设置 - 网络 - 当前WiFi - 设为"专用网络"后再试一次。
echo.
pause
