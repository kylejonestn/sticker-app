document.addEventListener('DOMContentLoaded', () => {
    // 3D scene variables
    let scene, camera, renderer, bottleMesh, controls;

    const allPages = document.querySelectorAll('.page');
    let currentUser = null;

    // --- Simple Hash-based Router ---
    async function navigate() {
        const hash = window.location.hash || '#login';
        const pageName = hash.split('?')[0].substring(1); 
        
        allPages.forEach(page => page.classList.add('hidden'));
        const activePage = document.getElementById(pageName + '-page') || document.getElementById('login-page');
        activePage.classList.remove('hidden');

        if (pageName === 'bottle' && currentUser) {
            await initBottlePage(currentUser);
        } else if (pageName === 'add-sticker') {
            initAddStickerPage(); 
        } else if (pageName === 'admin-dashboard') {
            if (sessionStorage.getItem('isAdmin') === 'true') {
                initAdminDashboard();
            } else {
                 window.location.hash = 'admin-login';
            }
        } else if (pageName === 'login') {
            currentUser = null;
            sessionStorage.removeItem('isAdmin');
        }
    }
    
    window.addEventListener('hashchange', navigate);
    navigate(); 

    // ===============================================
    //  LOGIN LOGIC
    // ===============================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const employeeId = document.getElementById('login-employee-id').value.trim();
            const loginError = document.getElementById('login-error');
            loginError.textContent = '';
            if (!employeeId) return;

            const formData = new FormData();
            formData.append('action', 'getUser');
            formData.append('employee_id', employeeId);

            try {
                const response = await fetch('api.php', { method: 'POST', body: formData });
                const data = await response.json();
                if (data.success) {
                    currentUser = data.user;
                    if (currentUser.employee_id === 'cg12420') {
                        sessionStorage.setItem('isAdmin', 'true');
                    }
                    window.location.hash = 'bottle';
                } else {
                    loginError.textContent = 'User not found.';
                }
            } catch (error) {
                loginError.textContent = 'Failed to connect to the server.';
            }
        });
    }

    const adminLoginForm = document.getElementById('admin-login-form');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-password-input').value;
            const adminError = document.getElementById('admin-error');
            if (password === 'cg12420') {
                sessionStorage.setItem('isAdmin', 'true');
                window.location.hash = 'admin-dashboard';
                adminError.textContent = '';
                document.getElementById('admin-password-input').value = '';
            } else {
                adminError.textContent = 'Incorrect password.';
            }
        });
    }

    const logoutLink = document.getElementById('logout-link');
    if(logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentUser = null;
            sessionStorage.removeItem('isAdmin');
            window.location.hash = 'login';
        });
    }

    // ===============================================
    //  BOTTLE CREATION & PAGE LOGIC
    // ===============================================
    function createWaterBottle() {
        const bottleGroup = new THREE.Group();

        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x00BFFF,
            roughness: 0.2,
            metalness: 0.1,
            transparent: true,
            opacity: 0.95
        });
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });

        const bodyGeo = new THREE.CylinderGeometry(0.8, 0.7, 3, 32);
        const bottleBody = new THREE.Mesh(bodyGeo, bodyMat);
        bottleBody.name = 'bottleBody';
        bottleGroup.add(bottleBody);

        const points = [
            new THREE.Vector2(0.4, 0),
            new THREE.Vector2(0.7, 0),
            new THREE.Vector2(0.7, 0.5),
            new THREE.Vector2(0.4, 0.8),
            new THREE.Vector2(0.4, 1.1)
        ];
        const lidGeo = new THREE.LatheGeometry(points, 32);
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.y = 1.5; 
        bottleGroup.add(lid);

        return bottleGroup;
    }

    async function initBottlePage(user) {
        const bottlePage = document.getElementById('bottle-page');
        const sceneContainer = document.getElementById('bottle-scene-container');
        const trophyCaseList = document.getElementById('trophy-case-list');
        
        sceneContainer.innerHTML = '';
        trophyCaseList.innerHTML = '';

        if (user.stickers && user.stickers.length > 0) {
            user.stickers.forEach(sticker => {
                const listItem = document.createElement('li');
                listItem.className = 'trophy-case-item';
                listItem.dataset.stickerId = sticker.id;
                listItem.innerHTML = `
                    <img src="${sticker.image_data}" alt="${sticker.event_name}" class="trophy-case-img">
                    <div class="trophy-case-info">
                        <h3>${sticker.event_name}</h3>
                        <p>${sticker.event_date}</p>
                    </div>
                `;
                trophyCaseList.appendChild(listItem);
            });
        } else {
            trophyCaseList.innerHTML = '<p style="text-align: center;">Your sticker collection is empty.</p>';
        }

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(50, sceneContainer.clientWidth / sceneContainer.clientHeight, 0.1, 1000);
        camera.position.z = 5;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        sceneContainer.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);

        const bottleGroup = createWaterBottle();
        scene.add(bottleGroup);
        bottleMesh = bottleGroup.getObjectByName('bottleBody');

        const decalPositions = [
            { pos: new THREE.Vector3(0, 0.75, 0.8), rot: new THREE.Euler(0, 0, 0) },
            { pos: new THREE.Vector3(0.8, 0, 0), rot: new THREE.Euler(0, -Math.PI / 2, 0) },
            { pos: new THREE.Vector3(0, -0.5, -0.8), rot: new THREE.Euler(0, Math.PI, 0) },
            { pos: new THREE.Vector3(-0.8, -1.0, 0), rot: new THREE.Euler(0, Math.PI / 2, 0) },
            { pos: new THREE.Vector3(0.6, 1.0, 0.6), rot: new THREE.Euler(0, -Math.PI / 4, 0) },
            { pos: new THREE.Vector3(-0.6, 0.25, 1.0), rot: new THREE.Euler(0, Math.PI / 4, 0) },
        ];
        const decalSize = new THREE.Vector3(1.2, 1.2, 1.2);

        const textureLoader = new THREE.TextureLoader();
        user.stickers.forEach((sticker, index) => {
            if (index >= decalPositions.length) return;

            textureLoader.load(sticker.image_data, (texture) => {
                const decalMaterial = new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    depthTest: true,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -4,
                });
                const decal = new THREE.Mesh(
                    new THREE.DecalGeometry(bottleMesh, decalPositions[index].pos, decalPositions[index].rot, decalSize),
                    decalMaterial
                );
                bottleMesh.add(decal);
            });
        });

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 3;
        controls.maxDistance = 10;
        controls.enablePan = false;

        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }
        animate();

        window.onresize = () => {
            if (!sceneContainer) return;
            camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(sceneContainer.clientWidth, sceneContainer.clientHeight);
        };
        
        const existingGear = bottlePage.querySelector('.admin-gear-link');
        if(existingGear) existingGear.remove();

        if (user.employee_id === 'cg12420') {
            const gearLink = document.createElement('a');
            gearLink.href = '#admin-dashboard';
            gearLink.className = 'admin-gear-link';
            gearLink.title = 'Go to Admin Dashboard';
            gearLink.innerHTML = `<span class="material-icons" style="font-size: 30px; color: white;">settings</span>`;
            bottlePage.appendChild(gearLink);
        }
    }

    // ===============================================
    //  ADD STICKER PAGE LOGIC
    // ===============================================
    async function initAddStickerPage() {
        const container = document.getElementById('claim-container');
        const stickerImage = document.getElementById('sticker-image');
        const claimButton = document.getElementById('claim-button');
        const idModal = document.getElementById('id-modal');
        const confirmModal = document.getElementById('confirm-modal');
        const registerModal = document.getElementById('register-modal');

        const errorDivs = document.querySelectorAll('#add-sticker-page .error-message');
        errorDivs.forEach(div => div.textContent = '');
        
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const stickerId = urlParams.get('id');

        if (!stickerId) {
            container.innerHTML = '<h1>Error: No sticker ID provided in the URL.</h1>';
            return;
        }

        function showClaimModal(modalToShow) {
            idModal.classList.add('hidden');
            confirmModal.classList.add('hidden');
            registerModal.classList.add('hidden');
            if (modalToShow) {
                modalToShow.classList.remove('hidden');
            }
        }

        try {
            const response = await fetch(`api.php?action=getStickerInfo&sticker_id=${stickerId}`);
            const data = await response.json();
            if (data.success) {
                stickerImage.src = data.sticker.image_data;
                stickerImage.alt = data.sticker.event_name;
            } else {
                container.innerHTML = `<h1>Error: ${data.message}</h1>`;
            }
        } catch (error) {
            container.innerHTML = `<h1>Error: Could not connect to the server.</h1>`;
        }

        claimButton.onclick = () => showClaimModal(idModal);

        document.querySelectorAll('#add-sticker-page .modal-back-button').forEach(button => {
            button.onclick = () => {
                const parentModal = button.closest('.modal');
                if (parentModal && parentModal.id === 'register-modal') {
                    showClaimModal(idModal);
                } else if (parentModal && parentModal.id === 'confirm-modal') {
                    showClaimModal(idModal);
                } else {
                    showClaimModal(null);
                }
            };
        });

        const idForm = document.getElementById('id-form');
        idForm.onsubmit = async (event) => {
            event.preventDefault();
            const idInput = document.getElementById('employee-id-input');
            const employeeId = idInput.value.trim();
            const idError = document.getElementById('id-error');
            idError.textContent = '';
            if (!employeeId) return;

            const formData = new FormData();
            formData.append('action', 'getUser');
            formData.append('employee_id', employeeId);
            
            const response = await fetch('api.php', { method: 'POST', body: formData });
            const data = await response.json();
            
            if (data.success) {
                const confirmTitle = document.getElementById('confirm-title');
                confirmTitle.textContent = `Add sticker to ${data.user.full_name}'s bottle?`;
                showClaimModal(confirmModal);
            } else {
                showClaimModal(registerModal);
            }
        };

        const registerForm = document.getElementById('register-form');
        registerForm.onsubmit = async (event) => {
            event.preventDefault();
            const employeeId = document.getElementById('employee-id-input').value.trim();
            const fullNameInput = document.getElementById('full-name-input');
            const fullName = fullNameInput.value.trim();
            const registerError = document.getElementById('register-error');
            registerError.textContent = '';

            const formData = new FormData();
            formData.append('action', 'registerAndAddSticker'); 
            formData.append('employee_id', employeeId);
            formData.append('full_name', fullName);
            formData.append('sticker_id', stickerId);

            const response = await fetch('api.php', { method: 'POST', body: formData });
            const data = await response.json();
            
            if(data.success) {
                await showSuccessAndRedirect(registerModal, employeeId);
            } else {
                registerError.textContent = data.message || 'Registration failed.';
            }
        };
        
        const confirmYesButton = document.getElementById('confirm-yes-button');
        confirmYesButton.onclick = async () => {
            const employeeId = document.getElementById('employee-id-input').value.trim();
            const formData = new FormData();
            formData.append('action', 'addSticker');
            formData.append('employee_id', employeeId);
            formData.append('sticker_id', stickerId);

            const response = await fetch('api.php', { method: 'POST', body: formData });
            const data = await response.json();
            
            if (data.success) {
                await showSuccessAndRedirect(confirmModal, employeeId);
            } else {
                alert('An error occurred. Could not add sticker.');
            }
        };

        async function showSuccessAndRedirect(currentModal, employeeId) {
            currentModal.querySelector('.modal-content').innerHTML = `<h2>Success!</h2><p>Sticker added. Redirecting to your collection...</p>`;
            
            const formData = new FormData();
            formData.append('action', 'getUser');
            formData.append('employee_id', employeeId);
            const response = await fetch('api.php', { method: 'POST', body: formData });
            const data = await response.json();

            setTimeout(() => {
                if (data.success) {
                    currentUser = data.user; 
                    window.location.hash = '#bottle';
                } else {
                    window.location.hash = '#login';
                }
            }, 2000);
        }
    }

    // ===============================================
    //  ADMIN DASHBOARD LOGIC
    // ===============================================
    async function initAdminDashboard() {
        const createStickerForm = document.getElementById('create-sticker-form');
        if (createStickerForm && !createStickerForm._isInitialized) {
            createStickerForm._isInitialized = true;
            createStickerForm.addEventListener('submit', handleCreateStickerSubmit);
        }

        const stickerCardList = document.getElementById('sticker-card-list');
        if (stickerCardList && !stickerCardList._isInitialized) {
            stickerCardList._isInitialized = true;
            stickerCardList.addEventListener('click', handleCardActions);
        }

        const shareModal = document.getElementById('share-modal');
        if (shareModal && !shareModal._isInitialized) {
            shareModal._isInitialized = true;
            const copyBtn = document.getElementById('copy-link-btn');
            const closeBtn = document.getElementById('close-share-modal-btn');
            const urlInput = document.getElementById('share-url-input');

            copyBtn.addEventListener('click', () => {
                urlInput.select();
                navigator.clipboard.writeText(urlInput.value);
                const icon = copyBtn.querySelector('.material-icons');
                icon.textContent = 'done';
                setTimeout(() => {
                    icon.textContent = 'content_copy';
                }, 2000);
            });

            closeBtn.addEventListener('click', () => {
                shareModal.classList.add('hidden');
            });
        }
        
        const feedbackModal = document.getElementById('feedback-modal');
        if (feedbackModal && !feedbackModal._isInitialized) {
            feedbackModal._isInitialized = true;
            const closeBtn = document.getElementById('close-feedback-modal-btn');
            closeBtn.addEventListener('click', () => {
                feedbackModal.classList.add('hidden');
            });
        }
        
        await loadAdminStickers();
    }

    async function handleCreateStickerSubmit(e) {
        e.preventDefault();
        const eventName = document.getElementById('event-name').value;
        const eventDate = document.getElementById('event-date').value;
        const description = document.getElementById('description').value;
        const fileInput = document.getElementById('sticker-image-upload');
        const file = fileInput.files[0];

        if (!eventName || !eventDate || !file) {
            alert('Please fill out Event Name, Event Date, and select an image.');
            return;
        }
        
        const createStickerBtn = document.getElementById('create-sticker-btn');
        createStickerBtn.disabled = true;
        createStickerBtn.textContent = 'Creating...';

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const imageData = reader.result;
            if (imageData.length > 1048487) {
                alert('The selected image is too large (max 1MB).');
                createStickerBtn.disabled = false;
                createStickerBtn.textContent = 'Create Sticker';
                return;
            }

            const formData = new FormData();
            formData.append('action', 'createSticker');
            formData.append('event_name', eventName);
            formData.append('event_date', eventDate);
            formData.append('description', description);
            formData.append('sticker_image_data', imageData);

            try {
                const response = await fetch('api.php', { method: 'POST', body: formData });
                const data = await response.json();
                if(data.success) {
                    alert('Sticker created successfully!');
                    e.target.reset();
                    await loadAdminStickers();
                } else {
                    alert('Error creating sticker: ' + data.message);
                }
            } catch(error) {
                alert("A server error occurred while creating the sticker.");
            } finally {
                createStickerBtn.disabled = false;
                createStickerBtn.textContent = 'Create Sticker';
            }
        };
        reader.onerror = () => {
             alert('Error reading the selected file.');
             createStickerBtn.disabled = false;
             createStickerBtn.textContent = 'Create Sticker';
        };
    }

    async function handleCardActions(e) {
        const button = e.target.closest('button.icon-btn');
        if (!button) return;

        const card = button.closest('.sticker-card');
        const id = card.dataset.stickerId;
        
        if (button.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to permanently delete this sticker?')) {
                const formData = new FormData();
                formData.append('action', 'deleteSticker');
                formData.append('sticker_id', id);
                await fetch('api.php', { method: 'POST', body: formData });
                await loadAdminStickers();
            }
        } else if (button.classList.contains('edit-btn')) {
            card.classList.add('editing');
            const title = card.querySelector('.sticker-card-title');
            const date = card.querySelector('.sticker-card-date');
            const description = card.querySelector('.sticker-card-body p');
            
            title.innerHTML = `<input type="text" class="form-group" value="${title.dataset.originalValue}">`;
            date.innerHTML = `<input type="date" class="form-group" value="${date.dataset.originalValue}">`;
            description.innerHTML = `<textarea rows="3" class="form-group">${description.dataset.originalValue}</textarea>`;

            button.innerHTML = '<span class="material-icons">save</span>';
            button.title = 'Save Changes';
            button.classList.remove('edit-btn');
            button.classList.add('save-btn');
        } else if (button.classList.contains('save-btn')) {
            const formData = new FormData();
            formData.append('action', 'updateStickerDetails');
            formData.append('sticker_id', id);
            formData.append('event_name', card.querySelector('.sticker-card-title input').value);
            formData.append('event_date', card.querySelector('.sticker-card-date input').value);
            formData.append('description', card.querySelector('.sticker-card-body textarea').value);

            await fetch('api.php', { method: 'POST', body: formData });
            await loadAdminStickers();
        } else if (button.classList.contains('share-btn')) {
            const modal = document.getElementById('share-modal');
            const urlInput = document.getElementById('share-url-input');
            const qrCanvas = document.getElementById('qr-code-canvas');
            
            const url = `${window.location.origin}${window.location.pathname}#add-sticker?id=${id}`;
            urlInput.value = url;
            
            new QRious({
                element: qrCanvas,
                value: url,
                size: 220,
                padding: 10,
                foreground: '#333'
            });
            
            modal.classList.remove('hidden');
        } else if (button.classList.contains('feedback-btn')) {
            const modal = document.getElementById('feedback-modal');
            const title = document.getElementById('feedback-modal-title');
            const container = document.getElementById('feedback-list-container');
            
            const cardTitle = card.querySelector('.sticker-card-title').textContent;
            title.textContent = `Feedback for "${cardTitle}"`;
            container.innerHTML = '<p>Loading feedback...</p>';
            modal.classList.remove('hidden');

            try {
                const response = await fetch(`api.php?action=getFeedback&sticker_id=${id}`);
                const data = await response.json();
                if (data.success && data.feedback.length > 0) {
                    container.innerHTML = data.feedback.map(fb => `
                        <div class="feedback-item">
                            <p class="feedback-comment">${fb.comment}</p>
                            <p class="feedback-meta">
                                <strong>${fb.full_name}</strong> (${fb.employee_id}) - 
                                <small>${new Date(fb.submitted_at).toLocaleString()}</small>
                            </p>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = '<p>No feedback has been submitted for this event yet.</p>';
                }
            } catch (error) {
                container.innerHTML = '<p>Could not load feedback due to a server error.</p>';
            }
        }
    }

    async function loadAdminStickers() {
        const stickerCardList = document.getElementById('sticker-card-list');
        if (!stickerCardList) return;
        stickerCardList.innerHTML = '<p>Loading stickers...</p>';
        
        try {
            const response = await fetch('api.php?action=getAllStickers');
            const data = await response.json();

            if (data.success && data.stickers) {
                stickerCardList.innerHTML = '';
                if (data.stickers.length === 0) {
                     stickerCardList.innerHTML = '<p>No stickers have been created yet.</p>';
                     return;
                }
                data.stickers.forEach(sticker => {
                    const card = document.createElement('div');
                    card.className = 'sticker-card';
                    card.dataset.stickerId = sticker.id;
                    
                    const eventName = sticker.event_name || '';
                    const eventDate = sticker.event_date || '';
                    const description = sticker.description || '';
                    const feedbackCount = sticker.feedback_count || 0;
                    
                    card.innerHTML = `
                        <div class="sticker-card-header">
                            <img src="${sticker.image_data}" alt="${eventName}" class="sticker-card-img">
                            <div class="sticker-card-title-block">
                                <h3 class="sticker-card-title" data-original-value="${eventName}">${eventName}</h3>
                                <p class="sticker-card-date" data-original-value="${eventDate}">${eventDate}</p>
                            </div>
                        </div>
                        <div class="sticker-card-body">
                            <p data-original-value="${description}">${description}</p>
                        </div>
                        <div class="sticker-card-stats">
                            <div class="stat-item">
                                <span class="material-icons" style="font-size: 20px;">groups</span>
                                <span>${sticker.collection_count || 0} Collected</span>
                            </div>
                        </div>
                        <div class="sticker-card-actions">
                            <button class="icon-btn share-btn" title="Share Sticker"><span class="material-icons">share</span></button>
                            <button class="icon-btn edit-btn" title="Edit Details"><span class="material-icons">edit</span></button>
                            <button class="icon-btn feedback-btn" title="View Feedback">
                                <span class="material-icons">chat_bubble_outline</span>
                                ${feedbackCount > 0 ? `<span class="badge">${feedbackCount}</span>` : ''}
                            </button>
                            <button class="icon-btn delete-btn" title="Delete"><span class="material-icons">delete</span></button>
                        </div>
                    `;
                    stickerCardList.appendChild(card);
                });
            } else {
                stickerCardList.innerHTML = `<p>Failed to load stickers: ${data.message || 'No stickers found.'}</p>`;
            }
        } catch (error) {
            stickerCardList.innerHTML = '<p>A server error occurred. Could not load stickers.</p>';
        }
    }
});