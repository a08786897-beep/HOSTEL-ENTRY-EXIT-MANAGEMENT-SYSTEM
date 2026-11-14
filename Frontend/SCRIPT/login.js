const authForm = document.querySelector('#authForm');
const toggleMode = document.querySelector('#toggleMode');
const nameField = document.querySelector('#nameField');
const nameInput = document.querySelector('#name');
const authMessage = document.querySelector('#authMessage');
const heading = document.querySelector('.login-heading h2');
const submitText = document.querySelector('.login-button span');
const modePrompt = document.querySelector('#modePrompt');
let registering = false;

function setMode(isRegistering) {
    registering = isRegistering;
    nameField.hidden = !registering;
    nameInput.required = registering;
    const passwordInput = document.querySelector('#password');
    passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
    passwordInput.minLength = registering ? 8 : 0;
    heading.textContent = registering ? 'Create your account' : 'Welcome Back';
    submitText.textContent = registering ? 'Create Account' : 'Sign In';
    modePrompt.textContent = registering ? 'Already registered?' : 'New student?';
    toggleMode.textContent = registering ? 'Sign in' : 'Create an account';
    authMessage.hidden = true;
}

toggleMode.addEventListener('click', () => setMode(!registering));

authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = authForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.querySelector('span').textContent = registering ? 'Creating account...' : 'Signing in...';
    authMessage.hidden = true;

    try {
        const identifier = document.querySelector('#userId').value.trim();
        const body = registering
            ? {
                username: nameInput.value.trim(),
                email: identifier,
                password: document.querySelector('#password').value
            }
            : {
                identifier,
                password: document.querySelector('#password').value
            };
        const result = await HEMS.request(`/auth/${registering ? 'register' : 'login'}`, {
            method: 'POST',
            body: JSON.stringify(body),
            allowUnauthorized: true
        });
        HEMS.storeSession(result);
        location.replace('dashboard.html');
    } catch (error) {
        HEMS.showMessage(authMessage, error.message);
    } finally {
        button.disabled = false;
        button.querySelector('span').textContent = registering ? 'Create Account' : 'Sign In';
    }
});

setMode(false);
