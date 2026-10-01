const { execFileSync } = require('child_process');

console.log('');
console.log('========================================');
console.log('WIN RDP ENABLER POST');
console.log('========================================');

const tailscale = 'C:\\Program Files\\Tailscale\\tailscale.exe';

try {

    if (!require('fs').existsSync(tailscale)) {

        console.log('Tailscale не найден.');

    } else {

        console.log('Выполняю Tailscale logout...');

        execFileSync(
            tailscale,
            ['logout'],
            {
                stdio: 'inherit',
                windowsHide: false
            }
        );

        console.log('Tailscale logout выполнен.');

    }

} catch (error) {

    console.log(
        `POST cleanup завершился с ошибкой: ${error.message}`
    );

}

console.log('========================================');
console.log('WIN RDP ENABLER POST COMPLETE');
console.log('========================================');
