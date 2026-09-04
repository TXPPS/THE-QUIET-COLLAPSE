import { PROJECT_TITLE, PROJECT_VERSION } from '@/config/project';

const shell = document.getElementById('boot-shell');
if (shell) shell.textContent = `${PROJECT_TITLE} ${PROJECT_VERSION}`;
