function populateGrid(spacerId, imagePaths) {
    const spacer = document.getElementById(spacerId);
    imagePaths.forEach((path) => {
        let img = document.createElement('img');
        img.src = path;
        img.onerror = () => console.error(`Failed to load image: ${path}`);
        spacer.appendChild(img);
    });
}
